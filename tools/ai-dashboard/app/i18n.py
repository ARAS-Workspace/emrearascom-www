"""
Interface language, and the flag a conversation is labelled with.

Copyright (C) 2026 Rıza Emre ARAS <r.emrearas@proton.me>
SPDX-License-Identifier: AGPL-3.0-or-later

Two different things share this file and should not be confused. The dashboard's
own language is a preference of whoever is reading it. A conversation's locale
is a fact recorded in the row: it names which llms-full file was in the system
prompt when the agent answered, which is the one thing about a turn that cannot
be recovered from its text.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

LOCALES_DIR = Path(__file__).parent / "locales"
SUPPORTED = ("tr", "en")
DEFAULT = "tr"

# The flag stands for the site locale, not for a country — there is no flag for
# a language. With exactly two locales the shorthand is unambiguous and reads
# faster than a code; GB is a choice among several for English.
FLAGS = {"tr": "🇹🇷", "en": "🇬🇧"}


def flag(locale: str | None) -> str:
    """The badge for a conversation's recorded locale, or a neutral mark when
    the row predates the column."""
    return FLAGS.get((locale or "").lower(), "🏳️")


@lru_cache(maxsize=None)
def _load(locale: str) -> dict[str, Any]:
    path = LOCALES_DIR / f"{locale}.json"
    if not path.exists():
        path = LOCALES_DIR / f"{DEFAULT}.json"
    return json.loads(path.read_text(encoding="utf-8"))


def translator(locale: str):
    """
    A lookup bound to one language.

    A missing key returns the key itself rather than an empty string: a gap in
    the translation should be visible in the interface, not silently blank.

    @example t = translator("tr"); t("conversations.title")
    """
    table = _load(locale if locale in SUPPORTED else DEFAULT)

    def t(key: str) -> str:
        node: Any = table
        for part in key.split("."):
            if not isinstance(node, dict) or part not in node:
                return key
            node = node[part]
        return node if isinstance(node, str) else key

    return t
