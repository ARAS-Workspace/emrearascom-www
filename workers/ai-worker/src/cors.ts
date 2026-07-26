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

import { CONFIG } from './config';
import type { Env } from './types';

/**
 * Origin-allowlist CORS. Never wildcard: every response (success AND error)
 * echoes the request origin only when allowlisted, always with Vary: Origin.
 */

function allowedOrigins(env: Env): readonly string[] {
	return env.ENVIRONMENT === 'development'
		? [...CONFIG.cors.allowedOrigins, ...CONFIG.cors.devOrigins]
		: CONFIG.cors.allowedOrigins;
}

/**
 * CORS headers for the given request. Returns Vary-only when the origin is
 * absent (same-origin/no-CORS request) or not allowlisted — the browser
 * blocks disallowed cross-origin reads on its own.
 * @example const cors = corsHeaders(request, env);
 */
export function corsHeaders(request: Request, env: Env): Record<string, string> {
	const origin = request.headers.get('Origin');
	const headers: Record<string, string> = { 'Vary': 'Origin' };

	if (origin && allowedOrigins(env).includes(origin)) {
		headers['Access-Control-Allow-Origin'] = origin;
		headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
		headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
		headers['Access-Control-Max-Age'] = String(CONFIG.cors.maxAgeSeconds);
	}

	return headers;
}

/**
 * Preflight response (OPTIONS).
 * @example if (request.method === 'OPTIONS') return preflightResponse(request, env);
 */
export function preflightResponse(request: Request, env: Env): Response {
	return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
