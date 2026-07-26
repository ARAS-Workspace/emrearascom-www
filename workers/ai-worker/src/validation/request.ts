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

/**
 * Chat body validation. Unknown/legacy fields (stream, max_tokens,
 * temperature, turnstileToken) are IGNORED, never rejected — the old
 * frontend keeps working. An invalid `locale` silently falls back to the
 * default; the integrity flow additionally requires the first AND last
 * message to be user turns. Detail messages are localized; the frontend
 * renders `details` as a table.
 */

export type ValidationResult =
	| { valid: true; request: ChatRequest; locale: Locale }
	| { valid: false; details: ValidationDetail[]; locale: Locale };

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
		return { valid: false, details: [{ field: 'messages', message: t.errors.tooManyMessages }], locale };
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
		if (content.length > CONFIG.validation.maxMessageLength) {
			details.push({ field: `messages[${i}].content`, message: t.errors.messageTooLong });
			continue;
		}

		// Canonical shape only — unknown per-message properties are dropped.
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

	return { valid: true, request: { messages, locale }, locale };
}
