"""
Taking a conversation out of the dashboard.

Copyright (C) 2026 Rıza Emre ARAS <r.emrearas@proton.me>
SPDX-License-Identifier: AGPL-3.0-or-later

An export carries the hashes, not only the text. A transcript without them is
just a document someone typed; with them it can be checked again later, by
anything that can compute SHA-256 over the same canonical form.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo

import chain
from i18n import flag

TZ = ZoneInfo("Europe/Istanbul")


def stamp(ms: int | None) -> str:
    """Epoch milliseconds as local time. The worker writes UTC; a human reading
    this is in Istanbul."""
    if not ms:
        return "—"
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).astimezone(TZ).strftime("%Y-%m-%d %H:%M:%S")


def _quote(text: str) -> str:
    """Markdown blockquote, preserving the blank lines inside a message."""
    return "\n".join(f"> {line}" if line else ">" for line in text.split("\n"))


def as_markdown(chain_id: str, branch: list[dict[str, Any]], verdicts: list[dict[str, Any]]) -> str:
    """One branch as a readable document, with the verification result stated."""
    if not branch:
        return ""

    first, last = branch[0], branch[-1]
    ok = all(v["ok"] for v in verdicts)
    lines = [
        f"# {flag(first.get('locale'))} Conversation {chain_id[:12]}",
        "",
        f"- **Chain**: `{chain_id}`",
        f"- **Turns**: {len(branch)}",
        f"- **Started**: {stamp(first.get('created_at'))}",
        f"- **Ended**: {stamp(last.get('created_at'))}",
        f"- **Model**: {first.get('model', '—')}",
        f"- **Locale**: {first.get('locale', '—')}",
        f"- **Integrity**: {'every turn reproduces its stored hashes' if ok else 'FAILED — see below'}",
        "",
        "---",
        "",
    ]

    for index, (row, verdict) in enumerate(zip(branch, verdicts)):
        lines += [
            f"## Turn {index + 1}",
            "",
            f"**{stamp(row.get('created_at'))}**",
            "",
            f"Input: {row.get('tokens_in', 0)} · Output: {row.get('tokens_out', 0)} · "
            f"Time: {row.get('latency_ms', 0)} ms · IP Hash: `{row.get('ip_hash') or '—'}`",
            "",
            "### Visitor",
            "",
            _quote(row["user_message"]),
            "",
            "### Agent",
            "",
            _quote(row["assistant_response"]),
            "",
            "<details><summary>Hashes</summary>",
            "",
            f"- `block_index`: {row['block_index']}",
            f"- `block_hash`: `{row['block_hash']}`" + ("" if verdict["block_ok"] else "  ← MISMATCH"),
            f"- `prev_hash`: `{row.get('prev_hash') or chain.ZERO_HASH}`",
            f"- `context_hash`: `{row['context_hash']}`" + ("" if verdict["context_ok"] else "  ← MISMATCH"),
            "",
            "</details>",
            "",
        ]

    return "\n".join(lines)


def as_json(chain_id: str, branch: list[dict[str, Any]], verdicts: list[dict[str, Any]]) -> str:
    """The same thing for a machine: rows verbatim, plus what verification found.

    Written with `ensure_ascii=False` so Turkish survives as Turkish rather than
    as escape sequences — the same reason the worker's canonical form does."""
    return json.dumps(
        {
            "chain_id": chain_id,
            "exported_at": datetime.now(tz=TZ).isoformat(),
            "turns": len(branch),
            "verified": all(v["ok"] for v in verdicts),
            "links_ok": chain.links_ok(branch),
            "complete": chain.is_complete(branch),
            "blocks": [
                {
                    **row,
                    "verification": {
                        "block_hash_ok": verdict["block_ok"],
                        "context_hash_ok": verdict["context_ok"],
                        "computed_block_hash": verdict["computed_block_hash"],
                        "computed_context_hash": verdict["computed_context_hash"],
                    },
                }
                for row, verdict in zip(branch, verdicts)
            ],
        },
        ensure_ascii=False,
        indent=2,
    )


def filename(chain_id: str, branch: list[dict[str, Any]], suffix: str, branch_index: int = 0, of: int = 1) -> str:
    when = datetime.fromtimestamp(branch[0]["created_at"] / 1000, tz=timezone.utc).astimezone(TZ)
    part = "" if of == 1 else f"-branch{branch_index + 1}"
    return f"{when.strftime('%Y%m%d-%H%M')}-{chain_id[:12]}{part}.{suffix}"
