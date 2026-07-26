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

/**
 * Structured console logging — picked up by Workers observability.
 * Never log message contents, tokens or raw IPs here.
 */

export function logInfo(event: string, data: Record<string, unknown> = {}): void {
	console.log(JSON.stringify({ level: 'info', event, ...data }));
}

export function logWarn(event: string, data: Record<string, unknown> = {}): void {
	console.warn(JSON.stringify({ level: 'warn', event, ...data }));
}

export function logError(event: string, error: unknown, data: Record<string, unknown> = {}): void {
	const message = error instanceof Error ? error.message : String(error);
	console.error(JSON.stringify({ level: 'error', event, message, ...data }));
}
