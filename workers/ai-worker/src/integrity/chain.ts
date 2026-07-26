// SPDX-License-Identifier: AGPL-3.0-or-later
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

import { canonicalizeMessages, normalizeMessages, normalizeText } from './normalize';
import type { ChainAnchor, ChatMessage, ConversationBlock, Env } from '../types';

/**
 * SHA-256 hash chain over conversation turns (WebCrypto; replaces the
 * reference implementation's keccak256/EIP-712 encoder with the same
 * guarantee — a tampered or fabricated client history cannot anchor).
 *
 * Rules:
 *  - Genesis = exactly 1 message → fresh chain_id (32 random bytes hex).
 *  - Continuation → drop the trailing user message, hash the prior
 *    context, look up D1 `context_hash` (UNIQUE); missing ⇒ violation.
 *  - Genesis prev_hash: ZERO_HASH inside the hash input, NULL in D1.
 *  - created_at: Date.now() (epoch milliseconds).
 */

const ZERO_HASH = '0'.repeat(64);
const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash of a full conversation context (the continuation lookup key).
 * @example const contextHash = await hashContext(priorMessages);
 */
export async function hashContext(messages: ChatMessage[]): Promise<string> {
	return sha256Hex(canonicalizeMessages(normalizeMessages(messages)));
}

/**
 * Hash of one block. Explicit field order: chain_id, block_index,
 * prev_hash, user_message, assistant_response.
 * @example const blockHash = await hashBlock({ chainId, blockIndex, prevHash, userMessage, assistantResponse });
 */
export async function hashBlock(input: {
	chainId: string;
	blockIndex: number;
	prevHash: string | null;
	userMessage: string;
	assistantResponse: string;
}): Promise<string> {
	const payload = JSON.stringify({
		chain_id: input.chainId,
		block_index: input.blockIndex,
		prev_hash: input.prevHash ?? ZERO_HASH,
		user_message: normalizeText(input.userMessage),
		assistant_response: normalizeText(input.assistantResponse),
	});
	return sha256Hex(payload);
}

export type IntegrityCheck =
	| { kind: 'genesis'; chainId: string }
	| { kind: 'continuation'; anchor: ChainAnchor }
	| { kind: 'violation' };

/**
 * Classify and verify the client-sent history against D1. The caller has
 * already validated that the last message is a user turn.
 * @example const check = await verifyHistory(env, request.messages);
 */
export async function verifyHistory(env: Env, messages: ChatMessage[]): Promise<IntegrityCheck> {
	// Genesis — a single user message anchors a brand new chain.
	if (messages.length === 1) {
		const chainId = [...crypto.getRandomValues(new Uint8Array(32))]
			.map((byte) => byte.toString(16).padStart(2, '0'))
			.join('');
		return { kind: 'genesis', chainId };
	}

	// Continuation — the prior context (everything before the new user
	// message) must already be anchored in D1.
	const priorMessages = messages.slice(0, -1);
	const priorContextHash = await hashContext(priorMessages);

	const anchor = await env.AI_LOGS_DB.prepare(
		'SELECT chain_id, block_hash, block_index FROM conversation_logs WHERE context_hash = ?',
	)
		.bind(priorContextHash)
		.first<ChainAnchor>();

	if (anchor === null) {
		return { kind: 'violation' };
	}

	return { kind: 'continuation', anchor };
}

/**
 * INSERT the new block. The caller AWAITS this before emitting the SSE
 * `done` event, so the next request can anchor immediately.
 * @example await logConversationBlock(env, block);
 */
export async function logConversationBlock(env: Env, block: ConversationBlock): Promise<void> {
	await env.AI_LOGS_DB.prepare(
		`INSERT INTO conversation_logs (
			chain_id, block_hash, prev_hash, block_index, context_hash, context,
			user_message, assistant_response, locale, ip_hash, model,
			tokens_in, tokens_out, latency_ms, tool_calls, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			block.chain_id,
			block.block_hash,
			block.prev_hash,
			block.block_index,
			block.context_hash,
			block.context,
			block.user_message,
			block.assistant_response,
			block.locale,
			block.ip_hash,
			block.model,
			block.tokens_in,
			block.tokens_out,
			block.latency_ms,
			block.tool_calls,
			block.created_at,
		)
		.run();
}

/**
 * Charge a turn's spend up front, while the request is still alive.
 *
 * A client that disconnects mid-stream still had its prompt generated and
 * billed, but the runtime tears the cancelled request down — nothing after
 * the abort is guaranteed to run, so accounting cannot wait until then.
 * Instead the spend is reserved as soon as the model reports it and released
 * again by {@link releaseUsageReservation} once the turn lands in
 * `conversation_logs`, which then carries the authoritative numbers.
 *
 * Reservations live outside `conversation_logs` so they can never be mistaken
 * for an anchorable turn, and the budgets sum both tables.
 *
 * @example const id = await reserveUsage(env, { chainId, tokensIn, ... });
 */
export async function reserveUsage(
	env: Env,
	entry: {
		chainId: string | null;
		locale: string;
		ipHash: string | null;
		model: string;
		tokensIn: number;
		tokensOut: number;
	},
): Promise<number | null> {
	const row = await env.AI_LOGS_DB.prepare(
		`INSERT INTO usage_ledger (chain_id, reason, locale, ip_hash, model, tokens_in, tokens_out, created_at)
		 VALUES (?, 'in_flight', ?, ?, ?, ?, ?, ?) RETURNING id`,
	)
		.bind(entry.chainId, entry.locale, entry.ipHash, entry.model, entry.tokensIn, entry.tokensOut, Date.now())
		.first<{ id: number }>();

	return row?.id ?? null;
}

/**
 * Drop a reservation once the completed turn has been written as a block, so
 * the same tokens are not counted twice.
 * @example await releaseUsageReservation(env, reservationId);
 */
export async function releaseUsageReservation(env: Env, id: number): Promise<void> {
	await env.AI_LOGS_DB.prepare('DELETE FROM usage_ledger WHERE id = ?').bind(id).run();
}

/**
 * SHA-256 of the client IP — pseudonymization for dashboard grouping
 * (reference-implementation behavior, kept by design).
 * @example const ipHash = await hashIp(clientIp);
 */
export async function hashIp(ip: string): Promise<string> {
	return sha256Hex(ip);
}

export { ZERO_HASH };
