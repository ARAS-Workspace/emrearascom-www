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
import { logWarn } from '../utils/logging';
import type { Locale } from '../translations';

/**
 * llms-full context source.
 *
 * Fetched fresh per message with `cache: 'no-store'` (the site also serves
 * these files with `cache-control: no-cache`), so a deploy is reflected in
 * the very next answer — including mid-session. One retry absorbs a
 * transient failure; a hard failure surfaces to the caller rather than
 * answering from a stale snapshot. There is no bundled copy on purpose:
 * the chat page is served by the same origin, so an unreachable site means
 * the user could not be chatting in the first place.
 */

export class LlmsContextError extends Error {}

async function fetchOnce(url: string): Promise<string> {
	const response = await fetch(url, { cache: 'no-store' });
	if (!response.ok) {
		throw new LlmsContextError(`llms fetch failed: ${response.status}`);
	}
	const text = await response.text();
	if (text.trim().length === 0) {
		throw new LlmsContextError('llms fetch returned an empty body');
	}
	return text;
}

/**
 * @example const context = await getLlmsContext(locale);
 */
export async function getLlmsContext(locale: Locale): Promise<string> {
	const url = CONFIG.llms.urls[locale];

	try {
		return await fetchOnce(url);
	} catch (error) {
		logWarn('llms_fetch_retry', { locale, message: error instanceof Error ? error.message : String(error) });
		return fetchOnce(url);
	}
}
