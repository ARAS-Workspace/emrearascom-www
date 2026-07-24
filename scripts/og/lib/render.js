// SPDX-License-Identifier: AGPL-3.0-or-later
// noinspection JSUnusedGlobalSymbols

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
 * OG card renderer.
 *
 * The card is *built* from a config object rather than filled into an exported
 * Illustrator SVG: the layout (canvas, background, signature placement, and one
 * spec per text field) lives in `og.config.js`, and this module turns a config
 * plus a set of values into a PNG. Swapping the design is a config edit — the
 * signature and fonts are the only binary inputs.
 *
 * resvg runs with `loadSystemFonts: false` and only the fonts named in the
 * config, so the output is byte-identical on every machine (a CI runner without
 * IBM Plex installed renders exactly what a local machine does).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

import { loadFont, wrap, escapeXml } from './text.js';

/** Pull the inner markup out of the signature SVG's single `<g>`. */
function readSignatureInner(file) {
  const svg = readFileSync(file, 'utf8');
  const match = svg.match(/<g[^>]*>([\s\S]*?)<\/g>/);
  if (!match) throw new Error(`signature file has no <g>: ${file}`);
  return match[1].trim();
}

/**
 * Prepare the reusable pieces a config needs — fonts loaded for measurement,
 * font file paths for resvg, and the signature markup — once, so a batch of
 * cards doesn't re-read them per post. Paths in the config are resolved
 * relative to `baseDir`.
 *
 * @param {object} config
 * @param {string} baseDir  Directory the config's relative paths resolve against.
 */
export function createRenderer(config, baseDir) {
  const resolve = (p) => path.resolve(baseDir, p);

  const fontFiles = Object.fromEntries(
    Object.entries(config.fonts).map(([key, spec]) => [key, resolve(spec.file)])
  );
  const measureFonts = Object.fromEntries(
    Object.entries(fontFiles).map(([key, file]) => [key, loadFont(file)])
  );
  const signatureInner = config.signature ? readSignatureInner(resolve(config.signature.file)) : null;

  /**
   * Build the card's SVG string for one set of values.
   * @param {Record<string, string>} values  Keyed by field name (title, …).
   */
  function buildSvg(values) {
    const { canvas, fields } = config;
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" ` +
        `viewBox="0 0 ${canvas.width} ${canvas.height}">`,
      // An opaque background: OG images land on unpredictable chat backdrops.
      `<rect width="${canvas.width}" height="${canvas.height}" fill="${canvas.background}" />`,
    ];

    if (config.signature && signatureInner) {
      const { x = 0, y = 0, scale = 1, fill } = config.signature;
      parts.push(
        `<g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}">${signatureInner}</g>`
      );
    }

    // Field order follows the config object's key order.
    for (const [key, spec] of Object.entries(fields)) {
      const raw = values[key];
      if (raw == null || raw === '') continue;

      const fontSpec = config.fonts[spec.font];
      const lines = spec.maxWidth
        ? wrap(measureFonts[spec.font], raw, spec.fontSize, spec.maxWidth, spec.maxLines)
        : [String(raw)];

      const lineHeight = spec.lineHeight ?? spec.fontSize * 1.25;
      const anchor = spec.anchor ?? 'start';
      const tspans = lines
        .map(
          (line, i) =>
            `<tspan x="${spec.x}" y="${spec.y + i * lineHeight}">${escapeXml(line)}</tspan>`
        )
        .join('');

      parts.push(
        `<text font-family="${fontSpec.family}" font-size="${spec.fontSize}" ` +
          `fill="${spec.fill}" text-anchor="${anchor}"` +
          `${spec.letterSpacing ? ` letter-spacing="${spec.letterSpacing}"` : ''}>${tspans}</text>`
      );
    }

    parts.push('</svg>');
    return parts.join('\n');
  }

  /**
   * Render one card to a PNG buffer.
   * @param {Record<string, string>} values
   * @returns {Buffer}
   */
  function renderPng(values) {
    const svg = buildSvg(values);
    const resvg = new Resvg(svg, {
      background: config.canvas.background,
      fitTo: { mode: 'width', value: config.canvas.width },
      font: {
        fontFiles: Object.values(fontFiles),
        loadSystemFonts: false, // determinism: only the fonts we ship
        defaultFontFamily: config.fonts[config.defaultFont ?? 'regular'].family,
      },
    });
    return resvg.render().asPng();
  }

  return { buildSvg, renderPng };
}
