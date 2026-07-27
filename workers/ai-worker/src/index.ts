// SPDX-License-Identifier: AGPL-3.0-or-later
// noinspection JSUnusedGlobalSymbols

/*
 * Copyright (C) 2026 Rıza Emre ARAS <r.emrearas@proton.me>
 *
 * This file is part of emrearas.com.
 *
 * emrearas.com is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version. See <https://www.gnu.org/licenses/>.
 */

/**
 * emrearas.com AI Worker — Claude-backed site agent (ai-worker.emrearas.com)
 *
 * Chat pipeline (order is load-bearing):
 *   CORS/preflight → path/method → Content-Length cap → session HMAC verify
 *   → parse + validation (409 when the conversation is full) → integrity
 *   verify (409) → the day's token meter (503 when it is spent) → llms-full
 *   fetch (503 when the site context cannot be read) → Claude stream → SSE
 *   out → D1 insert AWAITED before `done`.
 */

import { streamChatCompletion } from './claude/manager';
import { CONFIG } from './config';
import { corsHeaders, preflightResponse } from './cors';
import {
	hashBlock,
	hashContext as hashContextOf,
	hashIp,
	logConversationBlock,
	verifyHistory,
} from './integrity/chain';
import { getLlmsContext } from './llms/context';
import { addDailyUsage, readDailyUsage, secondsUntilUtcMidnight } from './usage/daily';
import { issueSessionToken, verifySessionToken } from './session/token';
import { validateChatRequest } from './validation/request';
import { verifyTurnstileToken } from './session/turnstile';
import { getTranslations, parseLocale } from './translations';
import { errorResponse } from './utils/errors';
import { logError, logInfo, logWarn } from './utils/logging';
import { sseEvent, sseHeaders } from './utils/sse';
import type { ConversationBlock, Env, SessionResponse } from './types';

export default {
	async fetch(request, env): Promise<Response> {
		try {
			if (request.method === 'OPTIONS') {
				return preflightResponse(request, env);
			}

			const t = getTranslations(CONFIG.localization.defaultLocale);
			const { pathname } = new URL(request.url);
			const isSession = pathname === CONFIG.endpoints.session;
			const isChat = pathname === CONFIG.endpoints.chat;

			if (!isSession && !isChat) {
				return errorResponse(request, env, 'NOT_FOUND', t.errors.endpointNotFound, 404);
			}
			if (request.method !== 'POST') {
				return errorResponse(request, env, 'METHOD_NOT_ALLOWED', t.errors.methodNotAllowed, 405);
			}

			// Content-Length is a client-supplied hint: absent (chunked upload)
			// or unparseable, it must not read as "no body", so only a declared,
			// over-cap length is rejected here. A body that omits the header is
			// not measured at all — what bounds it is the per-message length and
			// message-count caps applied after parsing.
			const declaredLength = Number.parseInt(request.headers.get('Content-Length') ?? '', 10);
			if (Number.isFinite(declaredLength) && declaredLength > CONFIG.validation.maxRequestBodySize) {
				return errorResponse(request, env, 'PAYLOAD_TOO_LARGE', t.errors.payloadTooLarge, 413);
			}

			// Awaited, not just returned: `return promise` leaves the try block
			// before the promise settles, so every rejection from the handlers
			// would bypass the catch below — and with it the localized envelope,
			// the CORS headers that envelope carries, and the error log.
			if (isSession) {
				return await handleSession(request, env);
			}
			return await handleChat(request, env);
		} catch (error) {
			logError('unhandled_error', error);
			const t = getTranslations(CONFIG.localization.defaultLocale);
			return errorResponse(request, env, 'API_ERROR', t.errors.apiError, 500);
		}
	},
} satisfies ExportedHandler<Env>;

/** Client IP for the pseudonymized `conversation_logs.ip_hash` column and Turnstile remoteip. */
function getClientIp(request: Request): string {
	return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/**
 * POST /api/v1/session — Turnstile siteverify → signed session token.
 * Order: parse → token presence → siteverify → issue. Nothing throttles
 * siteverify; Turnstile itself is the gate. `locale` in the body is
 * optional and only localizes errors.
 */
async function handleSession(request: Request, env: Env): Promise<Response> {
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		const t = getTranslations(CONFIG.localization.defaultLocale);
		return errorResponse(request, env, 'VALIDATION_ERROR', t.errors.invalidJson, 400);
	}

	const body = (rawBody ?? {}) as Record<string, unknown>;
	const locale = parseLocale(body.locale);
	const t = getTranslations(locale);

	const turnstileToken = body.turnstileToken;
	if (typeof turnstileToken !== 'string' || turnstileToken.length === 0) {
		return errorResponse(request, env, 'VALIDATION_ERROR', t.errors.turnstileTokenMissing, 400);
	}

	const verdict = await verifyTurnstileToken(env, turnstileToken, getClientIp(request));
	if (!verdict.ok) {
		logWarn('session_turnstile_rejected', { errorCodes: verdict.errorCodes });
		return errorResponse(request, env, 'TURNSTILE_FAILED', t.errors.turnstileFailed, 403);
	}

	const { token, payload } = await issueSessionToken(env.SESSION_SIGNING_KEY);
	logInfo('session_issued', { sid: payload.sid, exp: payload.exp });

	const responseBody: SessionResponse = { token, expiresAt: payload.exp * 1000 };
	return new Response(JSON.stringify(responseBody, null, 2), {
		status: 200,
		headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(request, env) },
	});
}

/**
 * POST /api/v1/chat — session-gated, integrity-chained, SSE-streamed chat.
 * Pre-parse gates run with the default locale (the body is unread yet).
 */
async function handleChat(request: Request, env: Env): Promise<Response> {
	const t = getTranslations(CONFIG.localization.defaultLocale);

	// 1. Session (cheap HMAC — before anything stateful; 401 → client re-solves Turnstile)
	const authorization = request.headers.get('Authorization') ?? '';
	const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
	const session = bearer === '' ? null : await verifySessionToken(bearer, env.SESSION_SIGNING_KEY);
	if (session === null) {
		return errorResponse(request, env, 'SESSION_INVALID', t.errors.sessionInvalid, 401);
	}

	// 2. Parse + validation (localized details table; verbatim envelope)
	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		return errorResponse(request, env, 'VALIDATION_ERROR', t.errors.invalidJson, 400);
	}

	const validation = validateChatRequest(rawBody);
	const tl = getTranslations(validation.locale);
	if (!validation.valid) {
		if (validation.full) {
			// A hard stop, on purpose: this conversation is over and the visitor
			// starts a new one. Rolling silently into a fresh chain would hide
			// that the agent no longer remembers what came before.
			return errorResponse(request, env, 'CONVERSATION_FULL', tl.errors.conversationFull, 409);
		}
		return errorResponse(request, env, 'VALIDATION_ERROR', tl.errors.validationFailed, 400, {
			details: validation.details,
		});
	}

	// 3. Integrity — the client-sent history must anchor in D1
	const integrity = await verifyHistory(env, validation.request.messages);
	if (integrity.kind === 'violation') {
		logWarn('integrity_violation', { sid: session.sid });
		return errorResponse(request, env, 'INTEGRITY_VIOLATION', tl.errors.integrityViolation, 409);
	}

	// 4. The day's meter. The only ceiling there is: the agent is a feature of
	// this site, not a service sold by the turn, so nothing is metered per
	// visitor or per conversation. When the day's tokens are gone the agent is
	// simply unavailable until the meter rolls over.
	if ((await readDailyUsage(env)) >= CONFIG.budget.tokensPerDay) {
		return errorResponse(request, env, 'AGENT_UNAVAILABLE', tl.errors.agentUnavailable, 503, {
			retryAfter: secondsUntilUtcMidnight(),
		});
	}

	// 5. Fresh site context (fetched per message, outside the chain)
	let llmsContext: string;
	try {
		llmsContext = await getLlmsContext(validation.locale);
	} catch (error) {
		logError('llms_context_unavailable', error, { locale: validation.locale });
		return errorResponse(request, env, 'API_ERROR', tl.errors.apiError, 503);
	}

	// 6. Claude stream → SSE. The D1 block is written and AWAITED before
	// the `done` event so the next message can anchor immediately.
	const messages = validation.request.messages;
	const startedAt = Date.now();
	// Client disconnect arrives as a `cancel()` on the response stream —
	// `request.signal` is not a reliable disconnect signal in Workers. On
	// disconnect the upstream call is aborted and the turn is dropped: an
	// unanswered turn must never enter the chain. What the model had already
	// reported by then stays on the day's meter.
	const upstream = new AbortController();
	let clientGone = false;
	let controller: ReadableStreamDefaultController<Uint8Array>;

	const write = async (chunk: Uint8Array): Promise<void> => {
		if (clientGone) {
			return;
		}
		try {
			controller.enqueue(chunk);
		} catch {
			clientGone = true;
			upstream.abort();
		}
	};

	/**
	 * The day's meter, fed from the model's own reports rather than from the end
	 * of the turn. Reports arrive as running totals, so only the difference is
	 * added, and the writes are chained so the counter has settled before the
	 * turn is declared done.
	 *
	 * Sitting above the turn is what lets an interrupted stream be counted at
	 * all: its input is reported the moment generation starts. Its output is
	 * not — that figure arrives only when generation completes — so an
	 * abandoned turn is counted short by whatever it had produced. See the
	 * module documentation in `usage/daily.ts`.
	 */
	let countedIn = 0;
	let countedOut = 0;
	let metered: Promise<void> = Promise.resolve();

	const meter = (usage: { input_tokens: number; output_tokens: number }): void => {
		const deltaIn = usage.input_tokens - countedIn;
		const deltaOut = usage.output_tokens - countedOut;
		countedIn = usage.input_tokens;
		countedOut = usage.output_tokens;
		metered = metered.then(() =>
			addDailyUsage(env, deltaIn, deltaOut).catch((error: unknown) => {
				logError('daily_usage_write_failed', error, { sid: session.sid });
			}),
		);
	};


	const pump = async (): Promise<void> => {
		let streamedText = '';
		try {
			const result = await streamChatCompletion(
				env.ANTHROPIC_API_KEY,
				env.ANTHROPIC_BASE_URL,
				messages,
				llmsContext,
				{
					onDelta: async (text) => {
						streamedText += text;
						await write(sseEvent('delta', { text }));
					},
					onUsage: meter,
				},
				upstream.signal,
			);

			if (clientGone) {
				// Whatever the model reported is already on the day's meter; the
				// turn itself is dropped, because an unanswered turn must never
				// enter the chain.
				logInfo('chat_aborted', { sid: session.sid, streamed: streamedText.length });
				return;
			}

			// Byte-identity invariant: what we log must equal what the client
			// accumulated, so an empty answer is emitted as a delta too.
			let assistantResponse = result.text;
			if (assistantResponse.length === 0) {
				assistantResponse = tl.errors.emptyResponse;
				await write(sseEvent('delta', { text: assistantResponse }));
			}

			const prevHash = integrity.kind === 'continuation' ? integrity.anchor.block_hash : null;
			const blockIndex = integrity.kind === 'continuation' ? integrity.anchor.block_index + 1 : 0;
			const chainId = integrity.kind === 'continuation' ? integrity.anchor.chain_id : integrity.chainId;
			const fullContext = [...messages, { role: 'assistant' as const, content: assistantResponse }];

			const block: ConversationBlock = {
				chain_id: chainId,
				block_hash: await hashBlock({
					chainId,
					blockIndex,
					prevHash,
					userMessage: messages[messages.length - 1].content,
					assistantResponse,
				}),
				prev_hash: prevHash,
				block_index: blockIndex,
				context_hash: await hashContextOf(fullContext),
				user_message: messages[messages.length - 1].content,
				assistant_response: assistantResponse,
				locale: validation.locale,
				ip_hash: await hashIp(getClientIp(request)),
				model: result.model,
				tokens_in: result.usage.input_tokens,
				tokens_out: result.usage.output_tokens,
				latency_ms: Date.now() - startedAt,
				created_at: Date.now(),
			};

			await logConversationBlock(env, block);

			// Settle the meter before saying the turn is done, so the next
			// request reads a total that includes this one.
			await metered;

			await write(
				sseEvent('done', {
					id: result.id,
					model: result.model,
					usage: result.usage,
					duration_ms: Date.now() - startedAt,
				}),
			);
			logInfo('chat_completed', {
				sid: session.sid,
				chain: chainId.slice(0, 12),
				block: blockIndex,
				tokens: result.usage.input_tokens + result.usage.output_tokens,
			});
		} catch (error) {
			// Aborted by the client: leave the chain untouched.
			if (clientGone) {
				logInfo('chat_aborted', { sid: session.sid, streamed: streamedText.length });
			} else {
				logError('chat_failed', error, { sid: session.sid });
				await write(sseEvent('error', { error: { type: 'API_ERROR', message: tl.errors.apiError }, status: 500 }));
			}
		} finally {
			try {
				controller.close();
			} catch {
				// Already closed by the client's disconnect.
			}
		}
	};

	const stream = new ReadableStream<Uint8Array>({
		start(streamController) {
			controller = streamController;
			// Tied to the stream's lifetime, not the request's: if the client
			// disconnects, `cancel` below stops the work.
			void pump();
		},
		cancel() {
			clientGone = true;
			upstream.abort();
			// The meter needs nothing here: it is fed as the model reports,
			// which is the point of feeding it from there. Its last write may
			// still be in flight — this handler takes no ExecutionContext, so
			// nothing extends it past cancellation.
		},
	});

	return new Response(stream, {
		status: 200,
		headers: { ...sseHeaders(), ...corsHeaders(request, env) },
	});
}
