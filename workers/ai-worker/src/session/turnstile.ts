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
import type { Env, TurnstileVerifyResponse } from '../types';

/**
 * Cloudflare Turnstile server-side verification (siteverify).
 * Sends secret + response + remoteip + idempotency_key; requires `success`
 * AND an allowlisted response `hostname` (skipped in development, where
 * dummy keys report placeholder hostnames). Fails closed on network errors.
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerdict {
	ok: boolean;
	errorCodes: string[];
}

/**
 * @example const verdict = await verifyTurnstileToken(env, token, clientIp);
 */
export async function verifyTurnstileToken(env: Env, token: string, remoteIp: string): Promise<TurnstileVerdict> {
	try {
		const response = await fetch(SITEVERIFY_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				secret: env.TURNSTILE_SECRET_KEY,
				response: token,
				remoteip: remoteIp,
				idempotency_key: crypto.randomUUID(),
			}),
		});

		const data = (await response.json()) as TurnstileVerifyResponse;
		const errorCodes = data['error-codes'] ?? [];

		if (!data.success) {
			logWarn('turnstile_rejected', { errorCodes });
			return { ok: false, errorCodes };
		}

		const isDevelopment = env.ENVIRONMENT === 'development';
		const hostnameAllowed =
			isDevelopment ||
			(typeof data.hostname === 'string' &&
				(CONFIG.session.expectedHostnames as readonly string[]).includes(data.hostname));

		if (!hostnameAllowed) {
			logWarn('turnstile_hostname_mismatch', { hostname: data.hostname ?? null });
			return { ok: false, errorCodes: ['hostname-mismatch'] };
		}

		return { ok: true, errorCodes: [] };
	} catch (error) {
		logWarn('turnstile_siteverify_unreachable', { message: error instanceof Error ? error.message : String(error) });
		return { ok: false, errorCodes: ['internal-error'] };
	}
}
