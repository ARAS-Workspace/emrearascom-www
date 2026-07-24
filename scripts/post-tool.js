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
 * post-tool — scaffold and touch blog posts.
 *
 *   node scripts/post-tool.js create <slug>   (npm run new-post <slug>)
 *   node scripts/post-tool.js touch  <slug>   (npm run touch-post <slug>)
 *
 * `create` copies `src/pages/blog/_template/` to `src/pages/blog/posts/<slug>/`
 * and stamps the timestamps. That is the whole publish step — the router is
 * never touched, because `/blog/:slug` resolves posts from this directory at
 * runtime and `scripts/lib/route-sources.js` expands the same listing at build
 * time. To unpublish, move the directory out of `posts/`.
 *
 * `touch` bumps `kv.updatedAt` only.
 */

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = path.join(ROOT, 'src/pages/blog/_template');
const POSTS_DIR = path.join(ROOT, 'src/pages/blog/posts');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const die = (msg) => {
  console.error(`[post-tool] ${msg}`);
  process.exit(1);
};
const log = (msg) => console.log(`[post-tool] ${msg}`);

/** Current Istanbul wall-clock time as 'DD/MM/YYYY HH:mm'. */
function nowStamp() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

/** @param {string} slug @returns {string} absolute post directory */
function postDir(slug) {
  if (!SLUG_RE.test(slug)) die(`invalid slug (kebab-case expected): ${slug}`);
  return path.join(POSTS_DIR, slug);
}

/** Read, mutate and write a post's meta.json, preserving 2-space formatting. */
function editMeta(dir, mutate) {
  const metaPath = path.join(dir, 'meta.json');
  if (!existsSync(metaPath)) die(`meta.json not found: ${metaPath}`);
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  mutate(meta);
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  return meta;
}

// ── Commands ───────────────────────────────────────────────────────

function createPost(slug) {
  const dir = postDir(slug);
  if (!existsSync(TEMPLATE_DIR)) die(`template not found: ${TEMPLATE_DIR}`);
  if (existsSync(dir)) die(`post already exists: ${dir}`);

  mkdirSync(POSTS_DIR, { recursive: true });
  cpSync(TEMPLATE_DIR, dir, { recursive: true });

  const stamp = nowStamp();
  editMeta(dir, (meta) => {
    meta.kv = { createdAt: stamp, updatedAt: stamp };
  });

  log(`created '${slug}' → src/pages/blog/posts/${slug}/`);
  log('');
  log('Next:');
  log('  1. fill in meta.json  → seo.tr / seo.en titles + descriptions, tags');
  log('  2. write index.mdx and index.en.mdx');
  log(`  3. npm run dev        → https://localhost:5173/blog/${slug}`);
  log('  4. npm run generate-llms && commit   (cover is built by prod, not committed)');
}

function touchPost(slug) {
  const dir = postDir(slug);
  if (!existsSync(dir)) die(`post not found: ${dir}`);
  const meta = editMeta(dir, (m) => {
    m.kv = m.kv ?? {};
    m.kv.updatedAt = nowStamp();
  });
  log(`bumped updatedAt for '${slug}' → ${meta.kv.updatedAt}`);
}

// ── Entry ──────────────────────────────────────────────────────────

const [cmd, slug] = process.argv.slice(2);
if (!cmd || !slug) die('usage: node scripts/post-tool.js <create|touch> <slug>');

switch (cmd) {
  case 'create':
    createPost(slug);
    break;
  case 'touch':
    touchPost(slug);
    break;
  default:
    die(`unknown command: ${cmd}`);
}
