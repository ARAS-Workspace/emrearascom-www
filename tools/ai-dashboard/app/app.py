"""
Site agent conversation dashboard.

Copyright (C) 2026 Rıza Emre ARAS <r.emrearas@proton.me>
SPDX-License-Identifier: AGPL-3.0-or-later

Runs on a laptop, reads production, writes nothing.

    streamlit run app/app.py

The table it reads is a hash chain, which changes what a dashboard over it is
for. Anyone can show rows; what this shows is whether the rows still say what
they said when they were written, and which conversation each row actually
belongs to once a chain has branched.

The session is the unit throughout: the sidebar lists sessions, the main pane
shows one. Nothing groups by ip_hash, because that column records the network a
turn arrived from rather than who sent it — a phone changing cells mid-chain
changes it while the conversation carries on, so grouping by it would split one
session into several that each look whole. It travels with the turn instead, in
the badge above the exchange, where it is a fact about that turn and nothing
more.
"""

from __future__ import annotations

from pathlib import Path

import streamlit as st

import chain
import d1
import export
from i18n import SUPPORTED, flag, translator

st.set_page_config(page_title="Site Agent — Conversations", page_icon="💬", layout="wide")

# The signature is the same monochrome file the site inlines, and it is inlined
# here for the same reason: it paints in `currentColor`, so it takes the theme's
# text colour and re-inks itself when the reader switches between light and
# dark. An <img> would need two files and a way to know which one to serve.

def _signature() -> str:
    """
    The signature, ready to inline.

    The XML declaration at the head of the file is dropped: it is legal in a
    standalone document and illegal in the middle of one, and a browser that
    meets it inside a page renders it as text. The width comes from here rather
    than from the file so the file stays the site's copy, unedited.
    """
    markup = (Path(__file__).parent / "assets" / "signature.svg").read_text(encoding="utf-8")
    markup = markup.replace('<?xml version="1.0" encoding="UTF-8"?>', "").strip()
    return markup.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ', 1)


SIGNATURE = _signature()
REPOSITORY = "https://github.com/ARAS-Workspace/emrearascom-www"


# ── Reads, cached for the length of a look ───────────────────────────────────
# Production data changes when a visitor asks something, not while a page is
# being read. A short cache keeps clicking between sessions from spending an API
# round trip each time; the sidebar has a button to drop it.

@st.cache_data(ttl=60, show_spinner=False)
def _totals():
    return d1.totals()


@st.cache_data(ttl=60, show_spinner=False)
def _conversations():
    return d1.conversations()


@st.cache_data(ttl=60, show_spinner=False)
def _chain_rows(chain_id: str):
    return d1.chain_rows(chain_id)


def _grouped(value) -> str:
    """Thousands separated, for a metric tile standing on its own."""
    return f"{int(value or 0):,}".replace(",", " ")


def _plain(value) -> str:
    """Digits only. In the turn badge several figures sit on one line, and a
    separator there reads as a break between two numbers rather than inside
    one."""
    return str(int(value or 0))


# ── Language ─────────────────────────────────────────────────────────────────

with st.sidebar:
    st.markdown(
        '<div style="display:flex;justify-content:center;margin:0 0 1.25rem;'
        'pointer-events:none">'
        f'<div style="width:11rem;line-height:0">{SIGNATURE}</div>'
        "</div>",
        unsafe_allow_html=True,
    )

    ui_locale = st.selectbox(
        "Dil / Language",
        SUPPORTED,
        format_func=lambda code: f"{flag(code)}  {'Türkçe' if code == 'tr' else 'English'}",
    )
    t = translator(ui_locale)
    if st.button("↻", help="refresh"):
        st.cache_data.clear()
        st.rerun()

configured, missing = d1.is_configured()
if not configured:
    st.title(t("app.title"))
    st.error(t("setup.missing").replace("{names}", missing))
    st.info(t("setup.hint"))
    st.stop()

try:
    totals = _totals()
    conversations = _conversations()
except d1.D1Error as error:
    st.title(t("app.title"))
    st.error(f"{t('setup.failed')} — {error}")
    # `st.stop()` ends the script run and does not return. The re-raise after it
    # is unreachable in practice and is here for the reader: without it, nothing
    # at this point states that execution cannot continue with the reads
    # undefined, and a checker is right to say so.
    st.stop()
    raise

if not totals or not totals.get("turns") or not conversations:
    st.title(t("app.title"))
    st.info(t("overview.empty"))
    st.stop()


# ── The session list ─────────────────────────────────────────────────────────
#
# In the sidebar, because picking a session is navigation rather than a filter:
# it stays on screen while the conversation beside it is read. No flag here —
# the locale belongs to each exchange and is shown there.

with st.sidebar:
    st.subheader(t("sessions.title"))
    st.caption(f"{len(conversations)} {t('sessions.count')}")

    def session_label(item):
        return (
            f"{export.stamp(item['started_at'])}"
            f"  ·  {item['turns']} {t('conversation.turns')}"
            f"  ·  {item['chain_id'][:12]}"
        )

    selected = st.radio(
        t("sessions.title"),
        conversations,
        format_func=session_label,
        label_visibility="collapsed",
    )

    st.divider()
    st.markdown(
        f"[![GitHub](https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white)]({REPOSITORY})"
    )
    st.caption(f"© 2026 {t('footer.copyright')}")


# ── Overview ─────────────────────────────────────────────────────────────────

st.title(t("app.title"))

columns = st.columns(4)
columns[0].metric(t("overview.turns"), _grouped(totals["turns"]))
columns[1].metric(t("overview.conversations"), _grouped(totals["conversations"]))
columns[2].metric(t("overview.tokensIn"), _grouped(totals["tokens_in"]))
columns[3].metric(t("overview.tokensOut"), _grouped(totals["tokens_out"]))
st.caption(f"{t('overview.span')}: {export.stamp(totals['first_seen'])} — {export.stamp(totals['last_seen'])}")

st.divider()


# ── The selected session ─────────────────────────────────────────────────────

selected_chain_id = selected["chain_id"]
rows = _chain_rows(selected_chain_id)
found = chain.branches(rows)

head = st.columns(4)
head[0].metric(t("conversation.turnsLabel"), _grouped(selected["turns"]))
head[1].metric(t("overview.tokensIn"), _grouped(selected["tokens_in"]))
head[2].metric(t("overview.tokensOut"), _grouped(selected["tokens_out"]))
head[3].metric(t("conversation.model"), selected["model"] or "—")
st.caption(f"`{selected_chain_id}`")

if len(found) > 1:
    st.warning(t("conversation.branches").replace("{count}", str(len(found))))
    st.caption(t("conversation.branchesHint"))

tabs = (
    st.tabs([f"{t('conversation.branch')} {i + 1}" for i in range(len(found))])
    if len(found) > 1
    else [st.container()]
)


for index, (branch, panel) in enumerate(zip(found, tabs)):
    with panel:
        if not branch:
            continue
        verdicts = chain.verify(branch)
        broken = [v for v in verdicts if not v["ok"]]

        if not chain.is_complete(branch):
            st.warning(t("conversation.incomplete"))
        if not chain.links_ok(branch):
            st.error(t("integrity.linksBroken"))

        if broken:
            st.error(t("integrity.broken").replace("{count}", str(len(broken))))
        else:
            st.success(t("integrity.verified").replace("{count}", str(len(verdicts))))
        st.caption(t("integrity.explain"))

        # Export sits above the transcript: it is what someone came for when
        # they came for a whole conversation rather than a passage of one.
        actions = st.columns([1, 1, 4])
        actions[0].download_button(
            t("export.markdown"),
            export.as_markdown(selected_chain_id, branch, verdicts),
            file_name=export.filename(selected_chain_id, branch, "md", index, len(found)),
            icon=":material/description:",
            mime="text/markdown",
            use_container_width=True,
        )
        actions[1].download_button(
            t("export.json"),
            export.as_json(selected_chain_id, branch, verdicts),
            file_name=export.filename(selected_chain_id, branch, "json", index, len(found)),
            icon=":material/data_object:",
            mime="application/json",
            use_container_width=True,
        )

        st.divider()

        for position, (turn, verdict) in enumerate(zip(branch, verdicts)):
            if position:
                st.divider()

            with st.chat_message("user"):
                st.markdown(turn["user_message"])
            with st.chat_message("assistant"):
                st.markdown(turn["assistant_response"])

            # What the row records about the exchange, one field to a line and
            # bounded, so it sits beside the integrity panel as a block of the
            # same weight rather than as a run-on line above the conversation.
            # The flag is read from this turn's own `locale`: it names which
            # llms-full file was in the system prompt when the agent answered,
            # which is the one thing about a turn that its text cannot tell you.
            with st.container(border=True):
                st.markdown(
                    # Two trailing spaces before the newline: a bare newline in
                    # markdown is not a line break, it folds the whole list into
                    # one paragraph.
                    "  \n".join(
                        f"**{label}** &nbsp; {value}"
                        for label, value in (
                            (t("conversation.locale"), f"{flag(turn.get('locale'))} {turn.get('locale') or '—'}"),
                            (t("conversation.block"), f"`#{turn['block_index']}`"),
                            (t("conversation.at"), export.stamp(turn["created_at"])),
                            (t("conversation.input"), _plain(turn["tokens_in"])),
                            (t("conversation.output"), _plain(turn["tokens_out"])),
                            (t("conversation.time"), f"{_plain(turn['latency_ms'])} ms"),
                            (t("conversation.ipHash"), f"`{turn.get('ip_hash') or '—'}`"),
                        )
                    ),
                    unsafe_allow_html=True,
                )

            with st.expander(t("integrity.title"), expanded=not verdict["ok"]):
                for label, stored, computed, ok in (
                    (t("integrity.blockHash"), turn["block_hash"], verdict["computed_block_hash"], verdict["block_ok"]),
                    (
                        t("integrity.contextHash"),
                        turn["context_hash"],
                        verdict["computed_context_hash"],
                        verdict["context_ok"],
                    ),
                ):
                    st.markdown(f"**{label}** {'✅' if ok else '❌'}")
                    st.code(f"{t('integrity.stored')}   {stored}\n{t('integrity.computed')} {computed}", language=None)
