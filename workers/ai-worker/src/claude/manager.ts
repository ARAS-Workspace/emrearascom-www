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

import Anthropic from '@anthropic-ai/sdk';

import systemPrompt from './prompts/system-prompt.md';
import { CONFIG } from '../config';
import type { ChatMessage } from '../types';

/**
 * Claude streaming call.
 *
 * `system` carries the persona/guardrails plus the freshly fetched
 * llms-full site content — never the message array, so the integrity
 * chain is unaffected by site updates mid-session. `cache_control` on the
 * last system block is opportunistic: Haiku's 4096-token cache floor makes
 * it borderline, and below the floor the marker is a silent no-op.
 * No tools, no thinking; parameters are server-fixed from CONFIG.
 */

export interface StreamCallbacks {
	/** One raw text delta — forwarded verbatim; byte-identity depends on it. */
	onDelta(text: string): Promise<void> | void;
	/**
	 * Running token usage, updated as the stream reports it. A turn the client
	 * abandons never reaches `finalMessage()`, so this is the only way its
	 * spend can still be charged against the budgets.
	 */
	onUsage(usage: { input_tokens: number; output_tokens: number }): void;
}

export interface StreamResult {
	/** Exact concatenation of every delta emitted (logged as-is). */
	text: string;
	id: string;
	model: string;
	usage: { input_tokens: number; output_tokens: number };
}

/**
 * @example const result = await streamChatCompletion(apiKey, messages, llmsContext, callbacks, signal);
 */
export async function streamChatCompletion(
	apiKey: string,
	baseURL: string | undefined,
	messages: ChatMessage[],
	llmsContext: string,
	callbacks: StreamCallbacks,
	signal: AbortSignal,
): Promise<StreamResult> {
	const client = new Anthropic(baseURL === undefined || baseURL === '' ? { apiKey } : { apiKey, baseURL });

	const stream = client.messages.stream(
		{
			model: CONFIG.claude.model,
			max_tokens: CONFIG.claude.maxTokens,
			system: [
				{ type: 'text', text: systemPrompt },
				{
					type: 'text',
					text: `<site_content>\n${llmsContext}\n</site_content>`,
					cache_control: { type: 'ephemeral' },
				},
			],
			messages: messages.map((message) => ({ role: message.role, content: message.content })),
		},
		{ signal },
	);

	// Input is reported once at message_start, output grows with message_delta.
	// Both are surfaced as they arrive so an abandoned turn is still billable.
	let text = '';
	let inputTokens = 0;
	let outputTokens = 0;
	for await (const event of stream) {
		if (event.type === 'message_start') {
			const { usage } = event.message;
			inputTokens =
				usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
			callbacks.onUsage({ input_tokens: inputTokens, output_tokens: outputTokens });
		} else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
			text += event.delta.text;
			await callbacks.onDelta(event.delta.text);
		} else if (event.type === 'message_delta') {
			outputTokens = event.usage.output_tokens;
			callbacks.onUsage({ input_tokens: inputTokens, output_tokens: outputTokens });
		}
	}

	const message = await stream.finalMessage();

	// Total input actually processed: uncached + cache writes + cache reads.
	// Anthropic reports these as three separate counters, and the system
	// blocks land in `cache_creation_input_tokens` on the first request of
	// a cache window — counting only `input_tokens` would under-report the
	// context by thousands of tokens and corrupt the budget accounting.
	return {
		text,
		id: message.id,
		model: message.model,
		usage: {
			input_tokens:
				message.usage.input_tokens +
				(message.usage.cache_creation_input_tokens ?? 0) +
				(message.usage.cache_read_input_tokens ?? 0),
			output_tokens: message.usage.output_tokens,
		},
	};
}
