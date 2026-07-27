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

import type { SseDeltaEvent, SseDoneEvent, SseErrorEvent } from '../types';

/**
 * Worker-owned SSE protocol helpers.
 *
 * Wire format (one event per write):
 *   event: delta|done|error
 *   data: <json>
 *   <blank line>
 */

const encoder = new TextEncoder();

type SseEventName = 'delta' | 'done' | 'error';

/**
 * @example controller.enqueue(sseEvent('delta', { text }));
 */
export function sseEvent(name: 'delta', data: SseDeltaEvent): Uint8Array;
export function sseEvent(name: 'done', data: SseDoneEvent): Uint8Array;
export function sseEvent(name: 'error', data: SseErrorEvent): Uint8Array;
export function sseEvent(name: SseEventName, data: unknown): Uint8Array {
	return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Response headers for an SSE stream. Content-Length is intentionally
 * absent — the runtime chunks ReadableStream bodies on its own.
 * @example new Response(stream, { headers: { ...sseHeaders(), ...cors } });
 */
export function sseHeaders(): Record<string, string> {
	return {
		'Content-Type': 'text/event-stream; charset=utf-8',
		'Cache-Control': 'no-cache',
	};
}
