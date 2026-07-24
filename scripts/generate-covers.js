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
 * Generate a per-locale OG cover for every blog post.
 *
 *   node scripts/generate-covers.js            → all posts, tr + en
 *   node scripts/generate-covers.js <slug> …   → only the named posts
 *
 * Covers are a **build artifact**, not committed source. This reads each post's
 * meta.json, renders the card via scripts/og (config-driven), and writes it to
 * public/assets/blog/<slug>/cover.<locale>.png. Vite copies public/ verbatim
 * into dist/, so the card ships at the stable, unhashed URL an OG crawler needs
 * (/assets/blog/<slug>/cover.<locale>.png) with no copy step of our own.
 *
 * Because it runs in `prod` before the build, a change to a post's title or
 * description regenerates its cover automatically — there is nothing to commit
 * and nothing to drift, so no CI check is needed. When no slugs are given it
 * clears the output directory first, so a deleted post leaves no stale cover.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './og/og.config.js';
import { createRenderer } from './og/lib/render.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OG_DIR = path.join(ROOT, 'scripts/og');
const POSTS_DIR = path.join(ROOT, 'src/pages/blog/posts');
const OUT_DIR = path.join(ROOT, 'public/assets/blog');
const LOCALES = ['tr', 'en'];
const OWNER = 'Rıza Emre ARAS'; // author fallback; keep in step with seoConfig

const log = (msg) => console.log(`[covers] ${msg}`);

/** 'DD/MM/YYYY HH:mm' (Istanbul) → Date. */
function parseKvDate(kv) {
  const [datePart, timePart] = kv.split(' ');
  const [d, m, y] = datePart.split('/').map(Number);
  const [hh = 0, mm = 0] = (timePart ?? '').split(':').map(Number);
  // Istanbul is UTC+3 year-round; build the instant explicitly.
  return new Date(Date.UTC(y, m - 1, d, hh - 3, mm));
}

const INTL_LOCALE = { tr: 'tr-TR', en: 'en-US' };

/** Long localized date, e.g. '20 Temmuz 2026' / 'July 20, 2026'. */
function formatDate(kv, locale) {
  const date = parseKvDate(kv);
  if (Number.isNaN(date.getTime())) return kv;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

/** Tags as a single line: 'ağ · wireguard'. */
const formatTags = (tags) => (Array.isArray(tags) ? tags.filter(Boolean).join('  ·  ') : '');

/** Map a post's meta.json to the renderer's field values for one locale. */
function valuesFor(meta, locale) {
  const seo = meta.seo?.[locale] ?? meta.seo?.tr ?? {};
  return {
    title: seo.title ?? '',
    description: seo.description ?? '',
    author: meta.author ?? OWNER,
    date: formatDate(meta.kv?.createdAt ?? '', locale),
    tags: formatTags(seo.tags),
  };
}

// ── Main ───────────────────────────────────────────────────────────

const filter = new Set(process.argv.slice(2));

if (!existsSync(POSTS_DIR)) {
  log('no posts directory — nothing to do');
  process.exit(0);
}

const slugs = readdirSync(POSTS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((slug) => existsSync(path.join(POSTS_DIR, slug, 'meta.json')))
  .filter((slug) => filter.size === 0 || filter.has(slug))
  .sort();

if (slugs.length === 0) {
  log(filter.size ? `no matching posts: ${[...filter].join(', ')}` : 'no posts found');
  process.exit(0);
}

// A full run owns the whole output directory, so a post deleted since the last
// run leaves no orphan cover behind. A filtered run only touches its slugs.
if (filter.size === 0) {
  rmSync(OUT_DIR, { recursive: true, force: true });
}

const { renderPng } = createRenderer(config, OG_DIR);

let written = 0;
for (const slug of slugs) {
  const meta = JSON.parse(readFileSync(path.join(POSTS_DIR, slug, 'meta.json'), 'utf8'));
  const dest = path.join(OUT_DIR, slug);
  mkdirSync(dest, { recursive: true });

  for (const locale of LOCALES) {
    const png = renderPng(valuesFor(meta, locale));
    writeFileSync(path.join(dest, `cover.${locale}.png`), png);
    written += 1;
  }
  log(`${slug} → cover.{${LOCALES.join(',')}}.png`);
}

log(`Wrote ${written} cover(s) across ${slugs.length} post(s).`);
