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

import { corsHeaders } from '../cors';
import type { Env, ErrorResponseBody, ErrorType, ValidationDetail } from '../types';

/**
 * JSON error responses. The envelope is kept verbatim from the reference
 * implementation: `{ error: { type, message, details? }, status, retryAfter? }`.
 * This site's chat reads `error.type` and `error.message`: the type decides
 * whether a refusal is retryable or ends the conversation, so it is part of the
 * contract rather than decoration. `status`, `retryAfter` and `details` are
 * carried for other clients and rendered by none.
 */

interface ErrorOptions {
	details?: ValidationDetail[];
	retryAfter?: number;
}

/**
 * @example return errorResponse(request, env, 'NOT_FOUND', t.errors.endpointNotFound, 404);
 */
export function errorResponse(
	request: Request,
	env: Env,
	type: ErrorType,
	message: string,
	status: number,
	options: ErrorOptions = {},
): Response {
	const body: ErrorResponseBody = {
		error: {
			type,
			message,
			...(options.details ? { details: options.details } : {}),
		},
		status,
		...(options.retryAfter !== undefined ? { retryAfter: options.retryAfter } : {}),
	};

	const headers: Record<string, string> = {
		'Content-Type': 'application/json; charset=utf-8',
		...corsHeaders(request, env),
	};
	if (options.retryAfter !== undefined) {
		headers['Retry-After'] = String(options.retryAfter);
	}

	return new Response(JSON.stringify(body, null, 2), { status, headers });
}
