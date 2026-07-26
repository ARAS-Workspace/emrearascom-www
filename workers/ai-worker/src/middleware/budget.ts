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
import type { Env } from '../types';

/**
 * Token budgets, derived entirely from D1 — no separate store. The
 * integrity layer logs every turn's tokens_in/tokens_out anyway, and the
 * insert is awaited before the SSE `done` event, so these sums are
 * consistent by the next request.
 *
 * Both sums span two tables: completed turns in `conversation_logs` and, in
 * `usage_ledger`, the spend of turns the client abandoned mid-stream. Those
 * were generated and billed but must never enter the hash chain, so leaving
 * them out of the sums would let an abandoned request cost money that no
 * ceiling counts.
 *
 *  - Conversation limit: SUM over the chain (idx_chain_id / idx_usage_chain_id).
 *  - Daily wallet fuse:  SUM over the UTC day (idx_logs_created / idx_usage_created).
 *
 * Runs AFTER integrity verification (needs the chain identity); genesis
 * requests only face the daily fuse. Skipped in development.
 */

export type BudgetVerdict = { allowed: true } | { allowed: false; reason: 'session' | 'daily'; retryAfter?: number };

const SECONDS_PER_DAY = 86400;

async function sumTokens(env: Env, sql: string, bind: (string | number)[]): Promise<number> {
	const row = await env.AI_LOGS_DB.prepare(sql)
		.bind(...bind)
		.first<{ total: number | null }>();
	return row?.total ?? 0;
}

/**
 * Gate: conversation budget (continuations only), then the daily fuse.
 * @example const verdict = await checkBudgets(env, check.kind === 'continuation' ? check.anchor.chain_id : null);
 */
export async function checkBudgets(env: Env, chainId: string | null): Promise<BudgetVerdict> {
	if (env.ENVIRONMENT === 'development') {
		return { allowed: true };
	}

	if (chainId !== null) {
		const chainTokens = await sumTokens(
			env,
			`SELECT (SELECT COALESCE(SUM(tokens_in + tokens_out), 0) FROM conversation_logs WHERE chain_id = ?1)
			      + (SELECT COALESCE(SUM(tokens_in + tokens_out), 0) FROM usage_ledger WHERE chain_id = ?1) AS total`,
			[chainId],
		);
		if (chainTokens >= CONFIG.budget.tokensPerSession) {
			return { allowed: false, reason: 'session' };
		}
	}

	const utcDayStartMs = Math.floor(Date.now() / (SECONDS_PER_DAY * 1000)) * SECONDS_PER_DAY * 1000;
	const dailyTokens = await sumTokens(
		env,
		`SELECT (SELECT COALESCE(SUM(tokens_in + tokens_out), 0) FROM conversation_logs WHERE created_at >= ?1)
		      + (SELECT COALESCE(SUM(tokens_in + tokens_out), 0) FROM usage_ledger WHERE created_at >= ?1) AS total`,
		[utcDayStartMs],
	);
	if (dailyTokens >= CONFIG.budget.tokensPerDay) {
		const now = Math.floor(Date.now() / 1000);
		return { allowed: false, reason: 'daily', retryAfter: SECONDS_PER_DAY - (now % SECONDS_PER_DAY) };
	}

	return { allowed: true };
}
