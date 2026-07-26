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

/** Text modules bundled via wrangler `rules` (Text: *.md, *.txt). */

declare module '*.md' {
	const content: string;
	export default content;
}

declare module '*.txt' {
	const content: string;
	export default content;
}
