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

import { CONFIG } from '../config';
import { getTranslations, parseLocale } from '../translations';
import type { ChatMessage, ChatRequest, ValidationDetail } from '../types';
import type { Locale } from '../translations';

const encoder = new TextEncoder();

/**
 * Chat body validation. Unknown/legacy fields (stream, max_tokens,
 * temperature, turnstileToken) are IGNORED, never rejected — the old
 * frontend keeps working. An invalid `locale` silently falls back to the
 * default. The first and last message must both be user turns — enforced
 * here, because the integrity chain downstream assumes it: it hashes
 * everything before the trailing user message as the prior context. Detail
 * messages are localized and returned in `details`; no client renders them.
 */

export type ValidationResult =
	| { valid: true; request: ChatRequest; locale: Locale }
	// `full` is not a malformed request — the conversation simply reached the
	// length this agent carries. It gets its own outcome so the client can say
	// so plainly instead of showing a validation error.
	| { valid: false; full: true; locale: Locale }
	| { valid: false; full?: false; details: ValidationDetail[]; locale: Locale };

/**
 * @example const result = validateChatRequest(rawBody);
 */
export function validateChatRequest(rawBody: unknown): ValidationResult {
	const body = (typeof rawBody === 'object' && rawBody !== null ? rawBody : {}) as Record<string, unknown>;
	const locale = parseLocale(body.locale);
	const t = getTranslations(locale);
	const details: ValidationDetail[] = [];

	const rawMessages = body.messages;
	if (!Array.isArray(rawMessages)) {
		return { valid: false, details: [{ field: 'messages', message: t.errors.invalidMessages }], locale };
	}
	if (rawMessages.length === 0) {
		return { valid: false, details: [{ field: 'messages', message: t.errors.emptyMessages }], locale };
	}
	if (rawMessages.length > CONFIG.validation.maxMessagesPerRequest) {
		return { valid: false, full: true, locale };
	}

	const messages: ChatMessage[] = [];
	for (let i = 0; i < rawMessages.length; i++) {
		const item = (typeof rawMessages[i] === 'object' && rawMessages[i] !== null ? rawMessages[i] : {}) as Record<
			string,
			unknown
		>;

		const role = item.role;
		if (role !== 'user' && role !== 'assistant') {
			details.push({ field: `messages[${i}].role`, message: t.errors.invalidRole });
			continue;
		}

		const content = item.content;
		if (typeof content !== 'string') {
			details.push({ field: `messages[${i}].content`, message: t.errors.invalidMessages });
			continue;
		}
		if (content.length === 0) {
			details.push({ field: `messages[${i}].content`, message: t.errors.messageEmpty });
			continue;
		}
		// Measured in bytes, not characters, because the request body cap it has
		// to stay under is measured in bytes. A character count would let a
		// conversation of non-Latin text pass every message check and still be
		// refused as oversized, which is the one refusal this design does not
		// want: a finished conversation must say it is finished.
		if (encoder.encode(content).length > CONFIG.validation.maxMessageLength) {
			details.push({ field: `messages[${i}].content`, message: t.errors.messageTooLong });
			continue;
		}

		messages.push({ role, content });
	}

	if (details.length > 0) {
		return { valid: false, details, locale };
	}

	if (messages[0].role !== 'user') {
		details.push({ field: 'messages[0].role', message: t.errors.firstMessageNotUser });
	}
	if (messages[messages.length - 1].role !== 'user') {
		details.push({ field: `messages[${messages.length - 1}].role`, message: t.errors.lastMessageNotUser });
	}
	if (details.length > 0) {
		return { valid: false, details, locale };
	}

	return { valid: true, request: { messages }, locale };
}
