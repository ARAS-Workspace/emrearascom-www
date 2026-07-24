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
 * Content registry — the only module that knows where posts live on disk.
 *
 * Publishing a post is a filesystem act, not a code edit: drop a directory
 * under `src/pages/blog/posts/<slug>/` holding a `meta.json` and the MDX
 * bodies, and it appears. Move that directory elsewhere and it is unpublished.
 * There is no router entry to add, no wrapper component to write, and no
 * `draft` flag — git already tracks what exists.
 *
 * `scripts/lib/route-sources.js` walks the same directory on the build side to
 * expand `/blog/:slug` into concrete prerendered routes. The two must agree on
 * the layout; this file and that one are the only places that encode it.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

import type { Locale } from '@shared/translations';
import type { BlogPostFile, BlogPostMeta } from '@shared/utils/schema-helpers';
import { byCreatedDesc } from './blog-helpers';

// Metadata is eager: it is small, and the listing page needs every post's
// front matter up front to sort and paginate. Bodies stay lazy (below).
const metaModules = import.meta.glob<BlogPostFile>('/src/pages/blog/posts/*/meta.json', {
  eager: true,
  import: 'default',
});

// Bodies are per-locale and lazy — one chunk per post per language, fetched
// only when that post is opened.
const bodyModules: Record<Locale, Record<string, () => Promise<unknown>>> = {
  tr: import.meta.glob('/src/pages/blog/posts/*/index.mdx'),
  en: import.meta.glob('/src/pages/blog/posts/*/index.en.mdx'),
};

/** '/src/pages/blog/posts/<slug>/meta.json' → '<slug>'. */
const slugFromKey = (key: string): string => key.split('/').at(-2) ?? '';

/** Every published post, newest first. */
export const posts: BlogPostMeta[] = Object.entries(metaModules)
  .map(([key, meta]) => ({ ...meta, slug: slugFromKey(key) }))
  .sort((a, b) => byCreatedDesc(a.kv.createdAt, b.kv.createdAt));

const postsBySlug = new Map(posts.map((post) => [post.slug, post]));

const bodiesBySlug: Record<Locale, Map<string, () => Promise<unknown>>> = {
  tr: new Map(Object.entries(bodyModules.tr).map(([key, load]) => [slugFromKey(key), load])),
  en: new Map(Object.entries(bodyModules.en).map(([key, load]) => [slugFromKey(key), load])),
};

/**
 * Look up one post's metadata.
 *
 * @param slug - Slug from the route params; `undefined` is tolerated so
 *   callers can pass `useParams()` output straight through.
 */
export const getPost = (slug: string | undefined): BlogPostMeta | undefined =>
  slug ? postsBySlug.get(slug) : undefined;

// `lazy()` must return a stable component identity across renders — a fresh
// one on every render would unmount and refetch the body each time.
const bodyCache = new Map<string, LazyExoticComponent<ComponentType>>();

/**
 * Lazy MDX body for a post, falling back to the Turkish original when a post
 * has not been translated.
 *
 * @param slug   - The post's slug
 * @param locale - Preferred language
 * @returns The lazy component, or `null` when the post has no body at all.
 */
export const getPostBody = (
  slug: string,
  locale: Locale
): LazyExoticComponent<ComponentType> | null => {
  const cacheKey = `${locale}:${slug}`;
  const cached = bodyCache.get(cacheKey);
  if (cached) return cached;

  const load = bodiesBySlug[locale]?.get(slug) ?? bodiesBySlug.tr.get(slug);
  if (!load) return null;

  const Body = lazy(load as () => Promise<{ default: ComponentType }>);
  bodyCache.set(cacheKey, Body);
  return Body;
};
