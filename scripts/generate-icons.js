#!/usr/bin/env node
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
 * Icon generator — rasterises the master `public/favicon.svg` into the full
 * favicon / PWA / apple-touch set that index.html + manifest.json reference.
 * Re-run whenever the master SVG changes:  node scripts/generate-icons.js
 *
 * Output (all under public/):
 *   assets/icons/favicon-{16,32,96,192}.png     transparent  (browser tabs)
 *   assets/icons/apple-touch-icon-{180,152,120,76,60}.png  white bg (iOS home)
 *   assets/icons/android-chrome-{192,512}.png    white bg, safe-zone (maskable)
 *   favicon.ico                                  16+32+48, PNG-in-ICO
 *
 * favicon.svg itself is the master and is served as-is; it is not regenerated.
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const ICONS = path.join(PUBLIC, 'assets', 'icons');
const MASTER = path.join(PUBLIC, 'favicon.svg');
const SIGNATURE = path.join(ROOT, 'src/shared/components/ui/assets/SignatureComponent/signature.svg');
const log = (m) => console.log(`[icons] ${m}`);

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Targets. `scale` is the icon's fraction of the canvas (1 = full bleed); the
// remainder is padded with `bg`. Maskable icons keep the logo inside the ~80%
// safe circle, so they render at 0.66 with a solid plate behind them.
const FAVICON = [16, 32, 48, 96, 192];
const APPLE = [180, 152, 120, 76, 60];
const ANDROID = [192, 512];
const ICO = [16, 32, 48];

if (!existsSync(MASTER)) {
  console.error(`[icons] master not found: ${MASTER}`);
  process.exit(1);
}
mkdirSync(ICONS, { recursive: true });

/** Compose the icon at `scale` centred on a `bg` plate, sized `size`×`size`. */
async function plate(master, size, scale, bg) {
  const inner = Math.round(size * scale);
  const left = Math.floor((size - inner) / 2);
  const top = Math.floor((size - inner) / 2);
  const fitted = await sharp(master)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  return sharp(fitted)
    .extend({ top, bottom: size - inner - top, left, right: size - inner - left, background: bg })
    .png()
    .toBuffer();
}

/** Pack PNG buffers (each a full square icon) into a single .ico container. */
function pngToIco(entries /* [{ size, buffer }] */) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);
  const dir = [];
  const blobs = [];
  let offset = 6 + entries.length * 16;
  for (const { size, buffer } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 ⇒ 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buffer.length, 8);
    e.writeUInt32LE(offset, 12);
    dir.push(e);
    blobs.push(buffer);
    offset += buffer.length;
  }
  return Buffer.concat([header, ...dir, ...blobs]);
}

const svg = readFileSync(MASTER);
// Rasterise the master once at high density → a crisp 1024² source that every
// target downsamples from (downscaling stays sharp; upscaling a small base blurs).
const master = await sharp(svg, { density: 384 })
  .resize(1024, 1024, { fit: 'contain', background: TRANSPARENT })
  .png()
  .toBuffer();

let n = 0;

for (const size of FAVICON) {
  await sharp(master).resize(size, size, { fit: 'contain', background: TRANSPARENT })
    .png().toFile(path.join(ICONS, `favicon-${size}.png`));
  n++;
}
log(`favicon-{${FAVICON.join(',')}}.png (transparent)`);

for (const size of APPLE) {
  const buf = await plate(master, size, 0.86, WHITE); // slight padding on white
  writeFileSync(path.join(ICONS, `apple-touch-icon-${size}.png`), buf);
  n++;
}
log(`apple-touch-icon-{${APPLE.join(',')}}.png (white)`);

for (const size of ANDROID) {
  const buf = await plate(master, size, 0.66, WHITE); // maskable safe-zone
  writeFileSync(path.join(ICONS, `android-chrome-${size}.png`), buf);
  n++;
}
log(`android-chrome-{${ANDROID.join(',')}}.png (white, maskable safe-zone)`);

const icoEntries = [];
for (const size of ICO) {
  const buffer = await sharp(master).resize(size, size, { fit: 'contain', background: TRANSPARENT })
    .png().toBuffer();
  icoEntries.push({ size, buffer });
}
writeFileSync(path.join(PUBLIC, 'favicon.ico'), pngToIco(icoEntries));
log(`favicon.ico (${ICO.join('+')})`);

// logo.png — the on-site signature rendered in its dark-theme colour
// (#f4f4f4 = Carbon g100 `--cds-text-primary`) on transparent, so the file
// matches exactly how <SignatureComponent> paints in dark mode. Recolour the
// SVG's `currentColor` (which the app drives via the theme) to that literal.
const SIG_INK = '#f4f4f4';
if (existsSync(SIGNATURE)) {
  const sig = readFileSync(SIGNATURE, 'utf8').replace(/fill="currentColor"/g, `fill="${SIG_INK}"`);
  await sharp(Buffer.from(sig), { density: 200 })
    .resize({ width: 1200 })
    .png()
    .toFile(path.join(PUBLIC, 'assets', 'images', 'logo.png'));
  log(`logo.png — signature (dark-mode ${SIG_INK}, transparent)`);
} else {
  log(`skip logo.png — signature not found: ${path.relative(ROOT, SIGNATURE)}`);
}

log(`done — ${n} PNG(s) + favicon.ico + logo.png from master + signature`);
