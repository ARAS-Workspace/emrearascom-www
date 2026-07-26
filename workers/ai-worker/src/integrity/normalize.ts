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

import type { ChatMessage } from '../types';

/**
 * Deterministic normalization before hashing: NFC unicode form and LF line
 * endings, so the same logical text always hashes identically regardless
 * of platform quirks.
 *
 * NO trimming, NO fallback substitution: the byte-identity invariant
 * requires the logged assistant_response to be the exact concatenation of
 * the streamed deltas. Whitespace differences are real differences.
 */

/**
 * @example const clean = normalizeText(message.content);
 */
export function normalizeText(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').normalize('NFC');
}

/**
 * Normalize a message list to the canonical {role, content} shape.
 * @example const canonical = normalizeMessages(request.messages);
 */
export function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
	return messages.map((message) => ({ role: message.role, content: normalizeText(message.content) }));
}

/**
 * Canonical serialization with EXPLICIT field order — never rely on
 * dynamic object key order. Arrays of messages serialize as a JSON array
 * of two-field objects, always role before content.
 * @example const payload = canonicalizeMessages(normalizeMessages(messages));
 */
export function canonicalizeMessages(messages: ChatMessage[]): string {
	return JSON.stringify(messages.map((message) => ({ role: message.role, content: message.content })));
}
