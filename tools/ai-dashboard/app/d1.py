"""
Cloudflare D1 read access over the HTTP API.

Copyright (C) 2026 Rıza Emre ARAS <r.emrearas@proton.me>
SPDX-License-Identifier: AGPL-3.0-or-later

This tool runs on a laptop and reads the production database directly. There is
no worker in front of it and no server of its own: the credentials come from
.env and never leave the process. Every statement here is a SELECT — the table
it reads is a tamper-evident chain, and a dashboard that could write to it would
be the one thing able to break the property the chain exists to provide.
"""

from __future__ import annotations

import os
import time
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
DATABASE_ID = os.getenv("D1_DATABASE_ID", "")
API_TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")

_BASE = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DATABASE_ID}"
_QUERY_URL = f"{_BASE}/query"

# The API answers in well under a second for this table; a long ceiling here
# only means a long stare at a spinner.
_TIMEOUT_SECONDS = 15
_MAX_ATTEMPTS = 3


class D1Error(RuntimeError):
    """Anything that stopped a query from returning rows."""


def is_configured() -> tuple[bool, str]:
    """
    Whether .env carries all three values, and which one is missing if not.

    Reported rather than raised, so the app can render an instruction instead of
    a stack trace — a missing token is the expected first-run state.
    """
    missing = [
        name
        for name, value in (
            ("CLOUDFLARE_ACCOUNT_ID", ACCOUNT_ID),
            ("D1_DATABASE_ID", DATABASE_ID),
            ("CLOUDFLARE_API_TOKEN", API_TOKEN),
        )
        if not value
    ]
    return (not missing), ", ".join(missing)


def query(sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    """
    Run one read and return its rows.

    Retries are for the transport only. A query that reaches D1 and is refused
    is refused for a reason — a malformed statement, a token without D1 read —
    and repeating it just delays the message that says so.

    @example rows = query("SELECT * FROM conversation_logs WHERE chain_id = ?", [chain_id])
    """
    ok, missing = is_configured()
    if not ok:
        raise D1Error(f"missing in .env: {missing}")

    payload: dict[str, Any] = {"sql": sql}
    if params:
        payload["params"] = params

    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Content-Type": "application/json",
    }

    last_error: Exception | None = None
    for attempt in range(_MAX_ATTEMPTS):
        try:
            response = requests.post(_QUERY_URL, json=payload, headers=headers, timeout=_TIMEOUT_SECONDS)
        except requests.RequestException as error:
            last_error = error
            if attempt + 1 < _MAX_ATTEMPTS:
                time.sleep(2**attempt)
                continue
            raise D1Error(f"could not reach the D1 API: {error}") from error

        if response.status_code == 401 or response.status_code == 403:
            raise D1Error(
                "the API token was refused — it needs the D1 read permission "
                "for this account, and it must be an account token rather than a user one"
            )
        if response.status_code >= 500 and attempt + 1 < _MAX_ATTEMPTS:
            time.sleep(2**attempt)
            continue

        try:
            body = response.json()
        except ValueError as error:
            raise D1Error(f"the D1 API answered {response.status_code} with a body that is not JSON") from error

        if not body.get("success"):
            errors = body.get("errors") or [{"message": response.text[:200]}]
            raise D1Error("; ".join(str(item.get("message", item)) for item in errors))

        result = body.get("result") or []
        if not result:
            return []
        return result[0].get("results", []) or []

    raise D1Error(f"gave up after {_MAX_ATTEMPTS} attempts: {last_error}")


def database_info() -> dict[str, Any]:
    """Name, size and row estimate, for the header. Never fatal — the dashboard
    is still readable without it."""
    try:
        response = requests.get(
            _BASE,
            headers={"Authorization": f"Bearer {API_TOKEN}"},
            timeout=_TIMEOUT_SECONDS,
        )
        body = response.json()
        return body.get("result") or {}
    except (requests.RequestException, ValueError):
        return {}


# ── Reads ────────────────────────────────────────────────────────────────────
#
# Each one is shaped around an index that migration 0001 put there for exactly
# this tool: chain_id for opening a conversation, created_at for ordering the
# session list.


def totals() -> dict[str, Any]:
    """One row of headline figures across the whole table."""
    rows = query(
        """
        SELECT COUNT(*)                    AS turns,
               COUNT(DISTINCT chain_id)    AS conversations,
               COALESCE(SUM(tokens_in), 0) AS tokens_in,
               COALESCE(SUM(tokens_out), 0) AS tokens_out,
               MIN(created_at)             AS first_seen,
               MAX(created_at)             AS last_seen
        FROM conversation_logs
        """
    )
    return rows[0] if rows else {}


def conversations(limit: int = 200) -> list[dict[str, Any]]:
    """
    One row per chain: when it ran, how big it got, what it cost.

    Nothing filters or groups by ip_hash, and nothing here aggregates it. That
    column records the network a turn arrived from rather than who sent it, and
    the two part company the moment a phone moves between cells: continuity is
    decided by context_hash, which never sees an address, so the conversation
    carries on while the ip_hash beside it changes mid-chain. Filtering rows by
    it and grouping after would split one session into two that each look whole
    — measured on this deployment, a four-turn chain reported as three turns
    under one hash and one turn under the other, token totals divided to match.
    It belongs to the turn, and the turn is where it is shown.

    `locale` and `model` are aggregated with MIN because a chain is one
    conversation in one language against one model; the columns are per row only
    because that is where the worker writes them.
    """
    return query(
        """
        SELECT chain_id,
               MIN(created_at)             AS started_at,
               MAX(created_at)             AS ended_at,
               COUNT(*)                    AS turns,
               COALESCE(SUM(tokens_in), 0) AS tokens_in,
               COALESCE(SUM(tokens_out), 0) AS tokens_out,
               MIN(locale)                 AS locale,
               MIN(model)                  AS model
        FROM conversation_logs
        GROUP BY chain_id
        ORDER BY started_at DESC
        LIMIT ?
        """,
        [limit],
    )


def chain_rows(chain_id: str) -> list[dict[str, Any]]:
    """
    Every row of one chain, unordered on purpose.

    Ordering happens in `chain.py`, by following prev_hash. Ordering here — by
    block_index, which is the obvious thing and what the reference
    implementation this tool is modelled on does — produces a transcript that
    was never said as soon as a conversation has been continued from two tabs.
    """
    return query(
        """
        SELECT id, chain_id, block_hash, prev_hash, block_index, context_hash,
               user_message, assistant_response, locale, ip_hash, model,
               tokens_in, tokens_out, latency_ms, created_at
        FROM conversation_logs
        WHERE chain_id = ?
        """,
        [chain_id],
    )
