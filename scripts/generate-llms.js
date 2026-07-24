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
 * Generate `llms/{tr,en}.txt` for every MDX-backed page by running the
 * agentic-data-builder over each page's `index.mdx` / `index.en.mdx`.
 *
 * Route → page directory comes from the router (lib/route-sources.js), which
 * also expands `/blog/:slug` into one entry per post — so posts are covered
 * without this script knowing anything about the blog.
 *
 * Pages with no MDX source are skipped, which is how the hand-written CV text
 * at `src/pages/home/llms/` survives: the home page is data-driven JSON, has
 * no `index.mdx`, and is therefore never overwritten (nor flagged by the CI
 * drift check, since nothing regenerates it).
 *
 * The output is committed. `scripts/build-llms.js` then copies it into dist/.
 *
 * Usage: npm run generate-llms
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildRouteMap } from './lib/route-sources.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOOL = path.join(ROOT, 'tools/agentic-data-builder/bin/agentic-data-builder.js');
const log = (msg) => console.log(`[gen-llms] ${msg}`);

/** Source MDX → output file, per locale. */
const LOCALES = [
  { input: 'index.mdx', output: 'llms/tr.txt', locale: 'tr' },
  { input: 'index.en.mdx', output: 'llms/en.txt', locale: 'en' },
];

/**
 * Insert the post's title as an H1 into its generated llms file.
 *
 * The builder works from the MDX body, which starts at `##` (the page's H1
 * comes from meta.json, not the body), so the generated llms would otherwise
 * carry no title and no top-level heading — failing the llms.txt "at least one
 * H1" rule and leaving the post untitled inside llms-full. This places
 * `# <title>` right after the `**path:**` line, matching the hand-written home
 * llms layout.
 *
 * Idempotent, and rewrites the heading if the title changed: the regex also
 * consumes an existing injected H1, so re-running never stacks duplicates.
 *
 * @param {string} outPath  The generated llms file.
 * @param {string} dir      The post directory (holds meta.json).
 * @param {string} locale   Which seo title to use.
 */
function injectTitle(outPath, dir, locale) {
  const metaPath = path.join(dir, 'meta.json');
  if (!existsSync(metaPath)) return; // MDX page without meta.json — leave as is
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const title = meta.seo?.[locale]?.title ?? meta.seo?.tr?.title;
  if (!title) return;

  const text = readFileSync(outPath, 'utf8');
  // Match the path line, plus any H1 already injected right after it.
  const pathRe = /(\*\*path:\*\*[^\n]*\n)(?:\n# [^\n]*\n)?/;
  if (!pathRe.test(text)) return; // no path line — nothing to anchor to
  const out = text.replace(pathRe, (_m, pathLine) => `${pathLine}\n# ${title}\n`);
  if (out !== text) writeFileSync(outPath, out, 'utf8');
}

if (!existsSync(TOOL)) {
  console.error(`[gen-llms] tool not found: ${TOOL}`);
  console.error('[gen-llms] run: npm --prefix tools/agentic-data-builder ci');
  process.exit(1);
}

const routes = [
  ...buildRouteMap(path.join(ROOT, 'src/router/index.tsx'), path.join(ROOT, 'src')),
].sort((a, b) => a[0].localeCompare(b[0]));

let generated = 0;
let pages = 0;
/** @type {string[]} */
const skipped = [];
/** @type {Set<string>} */
const fallback = new Set();

for (const [route, dir] of routes) {
  let any = false;
  for (const { input, output, locale } of LOCALES) {
    const inPath = path.join(dir, input);
    if (!existsSync(inPath)) continue;
    const outPath = path.join(dir, output);
    const stdout = execFileSync('node', [TOOL, inPath, outPath], {
      encoding: 'utf8',
    });
    for (const match of stdout.matchAll(/No rule for: ([^\n(]+)/g)) {
      for (const tag of match[1].split(',')) fallback.add(tag.trim());
    }
    injectTitle(outPath, dir, locale);
    generated += 1;
    any = true;
  }
  if (any) {
    pages += 1;
    log(route);
  } else {
    skipped.push(route);
  }
}

log(`Generated ${generated} file(s) across ${pages} page(s).`);
if (fallback.size) log(`Components left on fallback: ${[...fallback].sort().join(', ')}`);
if (skipped.length) log(`No MDX (hand-written or manual pages, skipped): ${skipped.join(', ')}`);
