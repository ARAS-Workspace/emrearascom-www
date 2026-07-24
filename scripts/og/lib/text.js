// SPDX-License-Identifier: AGPL-3.0-or-later
// noinspection JSCheckFunctionSignatures

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
 * Text measurement, word wrapping and XML escaping for the OG builder.
 *
 * SVG `<text>` does not wrap on its own, so a title that overflows the card
 * would simply run off the edge. We measure with the *same* font file resvg
 * renders with (via opentype.js), so the wrap points are accurate rather than
 * guessed — this is why the font must be a real TTF, not woff2.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// opentype.js is a CommonJS package (no ESM named exports); require it so its
// single export resolves cleanly under ESM.
const require = createRequire(import.meta.url);
const opentype = require('opentype.js');

/**
 * Load a TTF/OTF once; reuse the returned font for many measurements.
 * Uses `parse` on the file bytes — opentype.js v2 deprecated `loadSync` and it
 * returns undefined here.
 *
 * @param {string} fontPath  Path to a .ttf/.otf file.
 * @returns {import('opentype.js').Font}
 */
export function loadFont(fontPath) {
  // `Uint8Array.from` copies into a fresh, exactly-sized ArrayBuffer (a Buffer's
  // pool may be larger than the file). It takes an iterable, so it avoids the
  // constructor-overload ambiguity a Buffer argument triggers; opentype.parse
  // then takes the resulting ArrayBuffer.
  return opentype.parse(Uint8Array.from(readFileSync(fontPath)).buffer);
}

/**
 * Advance width of `text` at `fontSize`, in the same units as `fontSize`.
 * @param {import('opentype.js').Font} font
 * @param {string} text
 * @param {number} fontSize
 * @returns {number}
 */
export const measure = (font, text, fontSize) => font.getAdvanceWidth(text, fontSize);

/**
 * Greedy word-wrap to `maxWidth`. A single word longer than the line is left
 * on its own line rather than broken mid-word. When the result exceeds
 * `maxLines`, the last kept line is truncated with an ellipsis so nothing
 * spills past the box.
 *
 * @param {import('opentype.js').Font} font
 * @param {string} text
 * @param {number} fontSize
 * @param {number} maxWidth
 * @param {number} [maxLines]  Omit for unlimited lines.
 * @returns {string[]}
 */
export function wrap(font, text, fontSize, maxWidth, maxLines) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    // Keep the word if it fits, or if the line is empty (an over-long word has
    // nowhere else to go).
    if (!line || measure(font, candidate, fontSize) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);

  if (maxLines && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    const ELLIPSIS = '…';
    // Drop trailing words until the line plus the ellipsis fits.
    while (last.includes(' ') && measure(font, `${last}${ELLIPSIS}`, fontSize) > maxWidth) {
      last = last.replace(/\s*\S+$/, '');
    }
    kept[maxLines - 1] = `${last}${ELLIPSIS}`;
    return kept;
  }
  return lines;
}

const XML_ENTITIES = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };

/** Escape a string for inclusion in SVG/XML text content or an attribute. */
export const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => XML_ENTITIES[c]);
