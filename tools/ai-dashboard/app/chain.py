"""
Reading a conversation back out of the chain, and checking it still holds.

Copyright (C) 2026 Rıza Emre ARAS <r.emrearas@proton.me>
SPDX-License-Identifier: AGPL-3.0-or-later

Two things live here, and both exist because a stored conversation is not a
list of rows.

READING. A chain is a tree. Any client holding a conversation can continue it,
so two tabs open on the same one both anchor on the same context_hash row, both
compute the same block_index, and both insert. block_index is depth along a
branch, not a position in the chain: sorting by it interleaves branches into a
transcript nobody ever saw. What is reliable is the link each row carries —
walk prev_hash back from a tip and you have exactly one conversation as it was
actually said.

CHECKING. Every row stores the two hashes the worker computed when it wrote the
turn. Recomputing them here from the stored text is the only thing that makes
the chain worth having: if a row was edited in the database, the text no longer
produces the hash beside it.

The canonicalisation below has to match `workers/ai-worker/src/integrity/` byte
for byte or every block reads as broken. Two details do the damage in Python:
`json.dumps` escapes non-ASCII by default, where `JSON.stringify` emits UTF-8,
and it puts a space after every separator. Both are corrected explicitly.
"""

from __future__ import annotations

import hashlib
import json
import unicodedata
from typing import Any

ZERO_HASH = "0" * 64


def normalize_text(text: str) -> str:
    """
    NFC and LF, mirroring `normalizeText`.

    No trimming and no substitution: the worker's byte-identity invariant makes
    whitespace a real difference, and smoothing it here would report a tampered
    row as intact.
    """
    return unicodedata.normalize("NFC", text.replace("\r\n", "\n").replace("\r", "\n"))


def _stringify(value: Any) -> str:
    """`JSON.stringify` as JavaScript writes it: UTF-8 through, no padding."""
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def hash_block(
    chain_id: str,
    block_index: int,
    prev_hash: str | None,
    user_message: str,
    assistant_response: str,
) -> str:
    """
    Mirrors `hashBlock`. The field order is explicit and load-bearing — the
    worker never relies on dynamic key order and neither can this.
    """
    return _sha256_hex(
        _stringify(
            {
                "chain_id": chain_id,
                "block_index": block_index,
                "prev_hash": prev_hash if prev_hash else ZERO_HASH,
                "user_message": normalize_text(user_message),
                "assistant_response": normalize_text(assistant_response),
            }
        )
    )


def hash_context(messages: list[dict[str, str]]) -> str:
    """Mirrors `hashContext`: the whole conversation, role before content."""
    return _sha256_hex(
        _stringify([{"role": m["role"], "content": normalize_text(m["content"])} for m in messages])
    )


# ── The tree ─────────────────────────────────────────────────────────────────


def branches(rows: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """
    Split one chain's rows into the conversations they actually form.

    A tip is a row whose block_hash is nobody else's prev_hash — the last thing
    said on that branch. Walking prev_hash back from each tip yields one
    transcript per tip, ordered genesis-first. A chain that was never continued
    from two places has exactly one.

    A row whose prev_hash names a block that is not here stops its walk: the
    branch is returned as far as it could be followed, and `is_complete` on the
    result says so rather than pretending the fragment starts at the beginning.

    @example for branch in branches(chain_rows(chain_id)): ...
    """
    by_hash = {row["block_hash"]: row for row in rows}
    referenced = {row["prev_hash"] for row in rows if row.get("prev_hash")}
    tips = [row for row in rows if row["block_hash"] not in referenced]

    # A cycle would mean a hash collision or a hand-edited table; either way,
    # walking it forever is not the failure to have.
    out: list[list[dict[str, Any]]] = []
    for tip in sorted(tips, key=lambda r: r["created_at"]):
        walked: list[dict[str, Any]] = []
        seen: set[str] = set()
        current: dict[str, Any] | None = tip
        while current is not None and current["block_hash"] not in seen:
            seen.add(current["block_hash"])
            walked.append(current)
            prev = current.get("prev_hash")
            current = by_hash.get(prev) if prev else None
        walked.reverse()
        out.append(walked)
    return out


def is_complete(branch: list[dict[str, Any]]) -> bool:
    """Whether the branch reaches a genesis row rather than stopping at a link
    whose target is missing."""
    return bool(branch) and not branch[0].get("prev_hash")


# ── The check ────────────────────────────────────────────────────────────────


def verify(branch: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Recompute both hashes for every turn in a branch.

    The conversation is rebuilt as it grows, because context_hash covers the
    whole exchange up to and including its own turn — the same value the next
    request has to produce to be recognised as a continuation.

    Returns one verdict per turn: the row, whether each hash matches, and what
    was computed when it does not.

    @example results = verify(branch); broken = [r for r in results if not r["ok"]]
    """
    results: list[dict[str, Any]] = []
    conversation: list[dict[str, str]] = []

    for row in branch:
        conversation.append({"role": "user", "content": row["user_message"]})
        conversation.append({"role": "assistant", "content": row["assistant_response"]})

        computed_block = hash_block(
            row["chain_id"],
            row["block_index"],
            row.get("prev_hash"),
            row["user_message"],
            row["assistant_response"],
        )
        computed_context = hash_context(conversation)

        block_ok = computed_block == row["block_hash"]
        context_ok = computed_context == row["context_hash"]
        results.append(
            {
                "row": row,
                "block_ok": block_ok,
                "context_ok": context_ok,
                "ok": block_ok and context_ok,
                "computed_block_hash": computed_block,
                "computed_context_hash": computed_context,
            }
        )
    return results


def links_ok(branch: list[dict[str, Any]]) -> bool:
    """
    Whether each row names the one before it.

    Separate from `verify`: a branch can hash correctly turn by turn and still
    be spliced, if a row's prev_hash points somewhere other than its
    predecessor's block_hash. Walking builds the branch from those links, so
    this is really a check that the walk found what it should have.
    """
    for previous, current in zip(branch, branch[1:]):
        if current.get("prev_hash") != previous["block_hash"]:
            return False
    return True
