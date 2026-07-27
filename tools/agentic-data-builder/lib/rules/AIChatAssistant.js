/**
 *  █████╗ ██████╗  █████╗ ███████╗
 * ██╔══██╗██╔══██╗██╔══██╗██╔════╝
 * ███████║██████╔╝███████║███████╗
 * ██╔══██║██╔══██╗██╔══██║╚════██║
 * ██║  ██║██║  ██║██║  ██║███████║
 * ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝
 *
 * Copyright (C) 2026 Rıza Emre ARAS <r.emrearas@proton.me>
 *
 * This file is part of emrearas.com.
 *
 * emrearas.com is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
// Rule (mechanical): <AIChatAssistant /> → a one-line description of the
// widget. It is the whole body of /ai — the MDX is an H1 and the component —
// so without this rule the page's llms.txt would carry nothing but the generic
// "interactive component" fallback.
//
// The component takes no content props — its text comes from the site's
// translation bundle at runtime — so the rule is a constant per language. The
// language comes from the source file the way the generator names its outputs:
// `index.en.mdx` is the English page, anything else is Turkish. Every other
// rule derives its text from the MDX and so is already in the page's own
// language; a fixed English sentence would be the only foreign line in
// `llms/tr.txt`, and on this page the only line at all.

/** @typedef {import('../types.js').MdxProps} MdxProps */

const TEXT = {
  en: "> [AIChatAssistant] Interactive chat with the site agent — a Claude-backed assistant grounded in this site's content. Available on the live page at /ai.",
  tr: '> [AIChatAssistant] Site ajanıyla etkileşimli sohbet — sitenin içeriğiyle beslenen Claude tabanlı bir asistan. Canlı sayfada /ai adresinde kullanılabilir.',
};

/**
 * @param {MdxProps} _props
 * @param {unknown} _node
 * @param {{ sourcePath: string|null }} [context]
 * @returns {string}
 */
export function rule(_props, _node, context) {
  const isEnglish = (context?.sourcePath ?? '').endsWith('.en.mdx');
  return isEnglish ? TEXT.en : TEXT.tr;
}
