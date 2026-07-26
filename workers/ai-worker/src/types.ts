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

import type { Locale } from './translations';

// ============================================================================
// Worker Environment
// ============================================================================

export interface Env {
	// Bindings
	AI_LOGS_DB: D1Database;

	// Secrets
	ANTHROPIC_API_KEY: string;
	TURNSTILE_SECRET_KEY: string;
	SESSION_SIGNING_KEY: string;

	// Vars
	ENVIRONMENT?: string;
	/** Optional Anthropic API base URL override (e.g. an AI Gateway endpoint). */
	ANTHROPIC_BASE_URL?: string;
}

// ============================================================================
// Requests
// ============================================================================

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

/**
 * POST /api/v1/chat body. Unknown/legacy fields (stream, max_tokens,
 * temperature, turnstileToken) are ignored, never rejected.
 */
export interface ChatRequest {
	messages: ChatMessage[];
	locale?: Locale;
}

// ============================================================================
// Session Token
// ============================================================================

/** Signed payload: `base64url(json).base64url(hmac-sha256)`. */
export interface SessionPayload {
	/** Session id (UUID) — rate-limit key + log correlation. */
	sid: string;
	/** Issued at, Unix epoch seconds. */
	iat: number;
	/** Expires at, Unix epoch seconds. */
	exp: number;
}

export interface SessionResponse {
	token: string;
	/** Unix epoch milliseconds. */
	expiresAt: number;
}

// ============================================================================
// Errors — envelope kept verbatim from the reference implementation
// ============================================================================

export type ErrorType =
	| 'VALIDATION_ERROR'
	| 'PAYLOAD_TOO_LARGE'
	| 'NOT_FOUND'
	| 'METHOD_NOT_ALLOWED'
	| 'TURNSTILE_FAILED'
	| 'SESSION_INVALID'
	| 'RATE_LIMIT_EXCEEDED'
	| 'TOKEN_LIMIT_EXCEEDED'
	| 'INTEGRITY_VIOLATION'
	| 'API_ERROR'
	| 'NOT_IMPLEMENTED';

export interface ValidationDetail {
	field: string;
	message: string;
}

/** JSON error body: `{ error: { type, message, details? }, status, retryAfter? }`. */
export interface ErrorResponseBody {
	error: {
		type: ErrorType;
		message: string;
		details?: ValidationDetail[];
	};
	status: number;
	retryAfter?: number;
}

// ============================================================================
// SSE Protocol (worker-owned; not Anthropic passthrough, not UI-specific)
// ============================================================================

export interface SseDeltaEvent {
	text: string;
}

export interface SseDoneEvent {
	id: string;
	model: string;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
	duration_ms: number;
}

export interface SseErrorEvent {
	error: {
		type: ErrorType;
		message: string;
	};
	status: number;
}

// ============================================================================
// Turnstile
// ============================================================================

/** https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ */
export interface TurnstileVerifyResponse {
	'success': boolean;
	'challenge_ts'?: string;
	'hostname'?: string;
	'error-codes'?: string[];
	'action'?: string;
	'cdata'?: string;
}

// ============================================================================
// Integrity Chain
// ============================================================================

/** Row subset used for continuation lookup. */
export interface ChainAnchor {
	chain_id: string;
	block_hash: string;
	block_index: number;
}

/** One logged conversation turn (see migrations/0001). */
export interface ConversationBlock {
	chain_id: string;
	block_hash: string;
	/** Genesis: null in D1; "0" * 64 inside the canonical hash input. */
	prev_hash: string | null;
	block_index: number;
	context_hash: string;
	context: string;
	user_message: string;
	assistant_response: string;
	locale: Locale;
	/** SHA-256(ip) — pseudonymization for dashboard grouping. */
	ip_hash: string | null;
	model: string;
	tokens_in: number;
	tokens_out: number;
	latency_ms: number;
	/** Always null — column kept for dashboard compatibility. */
	tool_calls: string | null;
	/** Unix epoch milliseconds (Date.now()). */
	created_at: number;
}
