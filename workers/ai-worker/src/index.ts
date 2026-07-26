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
 *   → parse + validation → integrity verify (409) → token budgets from D1
 *   (conversation limit 429 → daily wallet fuse 503) → Claude stream →
 *   SSE out → D1 insert AWAITED before `done`.
 */

import { streamChatCompletion } from './claude/manager';
import { CONFIG } from './config';
import { corsHeaders, preflightResponse } from './cors';
import {
	hashBlock,
	hashContext as hashContextOf,
	hashIp,
	logConversationBlock,
	releaseUsageReservation,
	reserveUsage,
	verifyHistory,
} from './integrity/chain';
import { canonicalizeMessages, normalizeMessages } from './integrity/normalize';
import { getLlmsContext } from './llms/context';
import { checkBudgets } from './middleware/budget';
import { issueSessionToken, verifySessionToken } from './session/token';
import { validateChatRequest } from './validation/request';
import { verifyTurnstileToken } from './session/turnstile';
import { getTranslations, parseLocale } from './translations';
import { errorResponse } from './utils/errors';
import { logError, logInfo, logWarn } from './utils/logging';
import { sseEvent, sseHeaders } from './utils/sse';
import type { ConversationBlock, Env, SessionResponse } from './types';

export default {
	async fetch(request, env, ctx): Promise<Response> {
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
			// or unparseable, it must not read as "no body". Treat only a
			// declared, over-cap length as an early reject; the real enforcement
			// is on the bytes themselves, below.
			const declaredLength = Number.parseInt(request.headers.get('Content-Length') ?? '', 10);
			if (Number.isFinite(declaredLength) && declaredLength > CONFIG.validation.maxRequestBodySize) {
				return errorResponse(request, env, 'PAYLOAD_TOO_LARGE', t.errors.payloadTooLarge, 413);
			}

			if (isSession) {
				return handleSession(request, env, ctx);
			}
			return handleChat(request, env, ctx);
		} catch (error) {
			logError('unhandled_error', error);
			const t = getTranslations(CONFIG.localization.defaultLocale);
			return errorResponse(request, env, 'API_ERROR', t.errors.apiError, 500);
		}
	},
} satisfies ExportedHandler<Env>;

/** Client IP for rate limiting and Turnstile remoteip. */
function getClientIp(request: Request): string {
	return request.headers.get('CF-Connecting-IP') ?? 'unknown';
}

/**
 * POST /api/v1/session — Turnstile siteverify → signed session token.
 * Order: burst limit (protects siteverify) → token presence → siteverify
 * → issue. `locale` in the body is optional and only localizes errors.
 */
async function handleSession(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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
async function handleChat(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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

	// 4. Token budgets, derived from D1 (conversation limit → daily fuse)
	const chainId = integrity.kind === 'continuation' ? integrity.anchor.chain_id : null;
	const budget = await checkBudgets(env, chainId);
	if (!budget.allowed) {
		if (budget.reason === 'session') {
			return errorResponse(request, env, 'RATE_LIMIT_EXCEEDED', tl.errors.sessionCapacityReached, 429);
		}
		return errorResponse(request, env, 'TOKEN_LIMIT_EXCEEDED', tl.errors.dailyCapacityReached, 503, {
			retryAfter: budget.retryAfter,
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
	// `request.signal` is not a reliable disconnect signal in Workers.
	// On disconnect we abort the upstream call and log nothing: an
	// unanswered turn must never enter the chain.
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

	const chainIdForUsage = integrity.kind === 'continuation' ? integrity.anchor.chain_id : integrity.chainId;

	/**
	 * Charge this turn's spend the moment the model reports it, while the
	 * request is still alive. A client that disconnects mid-stream takes the
	 * request context down with it, so nothing after the abort can be relied on
	 * to run — a turn accounted only at the end would cost money no ceiling ever
	 * counted. The reservation is released once the turn is written as a block.
	 */
	let reservationId: number | null = null;
	const reserve = async (usage: { input_tokens: number; output_tokens: number }): Promise<void> => {
		if (reservationId !== null || usage.input_tokens === 0) {
			return;
		}
		try {
			reservationId = await reserveUsage(env, {
				chainId: chainIdForUsage,
				locale: validation.locale,
				ipHash: await hashIp(getClientIp(request)),
				model: CONFIG.claude.model,
				tokensIn: usage.input_tokens,
				tokensOut: usage.output_tokens,
			});
		} catch (error) {
			logError('usage_reservation_failed', error, { sid: session.sid });
		}
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
					onUsage: (usage) => {
						void reserve(usage);
					},
				},
				upstream.signal,
			);

			if (clientGone) {
				// Accounting already ran from `cancel()`.
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
				context: canonicalizeMessages(normalizeMessages(fullContext)),
				user_message: messages[messages.length - 1].content,
				assistant_response: assistantResponse,
				locale: validation.locale,
				ip_hash: await hashIp(getClientIp(request)),
				model: result.model,
				tokens_in: result.usage.input_tokens,
				tokens_out: result.usage.output_tokens,
				latency_ms: Date.now() - startedAt,
				tool_calls: null,
				created_at: Date.now(),
			};

			await logConversationBlock(env, block);

			// The block now carries the authoritative numbers; drop the
			// reservation so this turn is not counted twice.
			if (reservationId !== null) {
				try {
					await releaseUsageReservation(env, reservationId);
				} catch (error) {
					logError('usage_release_failed', error, { sid: session.sid });
				}
			}

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
			// Aborted by the client: log nothing, leave the chain untouched.
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
			// Nothing to record here: the spend was already reserved while the
			// stream was running, and only a completed turn releases it.
		},
	});

	return new Response(stream, {
		status: 200,
		headers: { ...sseHeaders(), ...corsHeaders(request, env) },
	});
}
