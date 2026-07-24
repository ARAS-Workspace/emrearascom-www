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

/**
 * OG card layout — the single place the design lives.
 *
 * `lib/render.js` turns this plus a post's values into a PNG. Every coordinate,
 * font size and colour is here; changing the card is editing this file, not the
 * renderer. Paths are relative to this file's directory.
 *
 * Canvas is the canonical OG size, 1200×630 (1.91:1) — the one image Open
 * Graph, Twitter `summary_large_image` and LinkedIn all accept. The draft's
 * vertical stack is kept but laid out for the wide canvas: title, description
 * and the author/date/tags meta run down the left, and the signature sits
 * bottom-right. Everything sits inside a ~72px safe margin so no client's crop
 * clips it.
 *
 * Field keys map to values produced by scripts/generate-covers.js:
 *   title ← seo.title · description ← seo.description · author ← meta.author
 *   date ← formatted kv.createdAt · tags ← joined meta.tags
 */

export const config = {
  canvas: {
    width: 1200,
    height: 630,
    background: '#161616',
  },

  // resvg selects fonts by these family names; `family` must match the font's
  // internal name (SemiBold registers as "IBM Plex Sans SemiBold", not weight
  // 600 on the base family). `defaultFont` is the fallback family for resvg.
  defaultFont: 'regular',
  fonts: {
    regular: { file: 'fonts/IBMPlexSans-Regular.ttf', family: 'IBM Plex Sans' },
    semibold: { file: 'fonts/IBMPlexSans-SemiBold.ttf', family: 'IBM Plex Sans SemiBold' },
  },

  // Signature outlined paths (no font dependency). Its own coordinate box is
  // 485.9×524.19; scaled and offset here to sit in the bottom-right corner.
  signature: {
    file: 'signature.svg',
    fill: '#ffffff',
    x: 705,
    y: 120,
    scale: 0.86,
  },

  // Left column: title (large) → description → meta stack. `y` is the baseline;
  // `maxWidth`/`maxLines` wrap and ellipsize so long copy never overflows.
  fields: {
    title: {
      x: 72,
      y: 150,
      fontSize: 76,
      font: 'semibold',
      fill: '#ffffff',
      lineHeight: 86,
      maxWidth: 1056,
      maxLines: 2,
    },
    description: {
      x: 72,
      y: 288,
      fontSize: 36,
      font: 'regular',
      fill: '#f4f4f4',
      lineHeight: 48,
      maxWidth: 980,
      maxLines: 2,
    },
    // author / date / tags: the meta stack, ~35% smaller than before
    // (30→20, 28→18) with tightened baselines to match.
    author: {
      x: 72,
      y: 474,
      fontSize: 20,
      font: 'regular',
      fill: '#c6c6c6',
    },
    date: {
      x: 72,
      y: 504,
      fontSize: 20,
      font: 'regular',
      fill: '#c6c6c6',
    },
    tags: {
      x: 72,
      y: 534,
      fontSize: 18,
      font: 'regular',
      fill: '#8d8d8d',
      maxWidth: 560,
      maxLines: 1,
    },
  },
};
