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

import type { Env } from '../types';

/**
 * The day's token meter.
 *
 * Tokens are what this worker is billed for, so tokens are what it counts, and
 * it counts them where the model reports them rather than where a turn
 * finishes. A stream the visitor walks out on has still been generated and
 * still costs money, and it reaches this total the same way a completed one
 * does. Nothing here concerns conversations, sessions or whether a connection
 * is still open, because none of that changes what was spent.
 *
 * One asymmetry is inherited from the API and cannot be closed here: input
 * tokens are reported at the start of a stream and are therefore always
 * counted, while output tokens are reported only once generation completes. A
 * turn abandoned mid-generation contributes its input and none of its output.
 * The undercount is bounded by `claude.maxTokens` per abandoned turn and is
 * small beside the input it does count — measured at roughly 6.5K in against at
 * most 4K out — but it is real, and the total is a close floor rather than an
 * exact figure.
 */

/** UTC calendar day, the row's identity. */
function utcDate(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * Add to today's total, creating the day's row on first use.
 * @example await addDailyUsage(env, deltaIn, deltaOut); // deltas: reports are running totals
 */
export async function addDailyUsage(env: Env, tokensIn: number, tokensOut: number): Promise<void> {
	if (tokensIn === 0 && tokensOut === 0) {
		return;
	}
	await env.AI_LOGS_DB.prepare(
		`INSERT INTO daily_usage (date, tokens_in, tokens_out) VALUES (?1, ?2, ?3)
		 ON CONFLICT(date) DO UPDATE SET tokens_in = tokens_in + ?2, tokens_out = tokens_out + ?3`,
	)
		.bind(utcDate(), tokensIn, tokensOut)
		.run();
}

/**
 * Tokens spent so far today.
 * @example if ((await readDailyUsage(env)) >= CONFIG.budget.tokensPerDay)
 */
export async function readDailyUsage(env: Env): Promise<number> {
	const row = await env.AI_LOGS_DB.prepare('SELECT tokens_in + tokens_out AS total FROM daily_usage WHERE date = ?')
		.bind(utcDate())
		.first<{ total: number }>();

	return row?.total ?? 0;
}

/** Seconds until the meter resets, for the client's retry hint. */
export function secondsUntilUtcMidnight(): number {
	const now = Date.now();
	const nextMidnight = Date.UTC(
		new Date(now).getUTCFullYear(),
		new Date(now).getUTCMonth(),
		new Date(now).getUTCDate() + 1,
	);
	return Math.ceil((nextMidnight - now) / 1000);
}
