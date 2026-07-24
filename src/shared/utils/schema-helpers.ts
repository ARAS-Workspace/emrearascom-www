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

import { getSiteConfig, type SiteConfig } from '@shared/config/seoConfig';
import type { Locale } from '@shared/translations';
import { toISO } from './date-helpers';

// ============================================================================
// Helpers
// ============================================================================

/** BCP-47 language tag for schema `inLanguage` fields. */
const inLanguageTag = (locale: Locale): string => (locale === 'tr' ? 'tr-TR' : 'en-US');

/** Stable `@id` of the single Person node this whole site revolves around. */
const personId = (siteConfig: SiteConfig): string => `${siteConfig.url}/#person`;

/** Stable `@id` of the Blog node — posts point back at it via `isPartOf`. */
const blogId = (siteConfig: SiteConfig): string => `${siteConfig.url}/blog#blog`;

/** Absolute site URL for a root-relative path. */
const absoluteUrl = (siteConfig: SiteConfig, path: string): string =>
  `${siteConfig.url}${path.startsWith('/') ? path : `/${path}`}`;

/**
 * Reference to the canonical Person node, used for author and publisher.
 *
 * Carries `@type`, `name` and `url` alongside the `@id` rather than the `@id`
 * alone. The full Person node lives only on the home page (ProfilePage's
 * mainEntity), so on a standalone post a bare `{ @id }` can't be resolved — a
 * validator then reports an untyped "Thing" with no name. Repeating the type
 * and name here keeps the reference self-describing while the shared `@id`
 * still ties it to the one canonical Person.
 */
const personRef = (siteConfig: SiteConfig) => ({
  '@type': 'Person',
  '@id': personId(siteConfig),
  name: siteConfig.author.name,
  url: siteConfig.url,
});

// ============================================================================
// Blog content types
// ----------------------------------------------------------------------------
// `BlogPostFile` is exactly what a post's meta.json holds. `slug` is NOT part
// of it — it is derived from the containing directory name, so the folder is
// the single source of truth and the two can never disagree. The content
// registry injects it, producing `BlogPostMeta`.
// ============================================================================

export interface BlogPostSeo {
  title: string;
  description: string;
  /** Per-locale labels ('ağ' vs 'networking'). Data only — rendered as chips
   *  and emitted as schema `keywords`; deliberately not a navigable taxonomy. */
  tags: string[];
}

export interface BlogPostFile {
  /** Istanbul wall-clock stamps, 'DD/MM/YYYY HH:mm'. Shared across locales. */
  kv: { createdAt: string; updatedAt: string };
  /** Byline. Optional — omit it and the post is attributed to the site owner.
   *  Shared across locales. */
  author?: string;
  seo: Record<Locale, BlogPostSeo>;
}

export interface BlogPostMeta extends BlogPostFile {
  /** Derived from the post's directory name. */
  slug: string;
}

/**
 * Root-relative cover URL for a post. Every post gets a generated card at a
 * fixed, unhashed path under `public/assets/blog/` (a build artifact — see
 * scripts/generate-covers.js), so there is always an image and nothing to
 * configure per post. Both the SEO meta tags and the BlogPosting schema resolve
 * the cover through here so they never diverge.
 */
export const coverPath = (meta: BlogPostMeta, locale: Locale): string =>
  `/assets/blog/${meta.slug}/cover.${locale}.png`;

// ============================================================================
// Identity constants
// ----------------------------------------------------------------------------
// Facts about the site owner that do not belong in the locale SEO JSON
// (jobTitle / worksFor / knowsAbout have no place in the OpenGraph-oriented
// SiteConfig). Name, url and social handles still come from getSiteConfig.
// ============================================================================

const PERSON = {
  jobTitle: { tr: 'Bilgisayar Mühendisi', en: 'Computer Engineer' },
  worksFor: { name: 'ARTEK', url: 'https://www.artek.tc' },
  knowsAbout: {
    tr: ['Yazılım Geliştirme', 'Ağ Teknolojileri', 'Bilgi Güvenliği', 'Sistem Mimarisi', 'Açık Kaynak'],
    en: ['Software Engineering', 'Networking', 'Information Security', 'System Architecture', 'Open Source'],
  },
  // Owned profiles beyond the social handles in seoConfig; merged into sameAs.
  sameAs: ['https://www.phantom.tc', 'https://www.artek.tc'],
} as const;

// ============================================================================
// Schema builders
// ============================================================================

/**
 * The Person node — same shape whether emitted standalone (`createPersonSchema`)
 * or embedded as a ProfilePage's `mainEntity`. Carries the canonical `@id` so
 * every author/publisher reference resolves to it.
 */
const buildPerson = (locale: Locale) => {
  const siteConfig = getSiteConfig(locale);
  const social = Object.values(siteConfig.social).filter(Boolean) as string[];
  const sameAs = Array.from(new Set([...social, ...PERSON.sameAs]));
  return {
    '@type': 'Person',
    '@id': personId(siteConfig),
    name: siteConfig.author.name,
    url: siteConfig.url,
    jobTitle: PERSON.jobTitle[locale],
    worksFor: {
      '@type': 'Organization',
      name: PERSON.worksFor.name,
      url: PERSON.worksFor.url,
    },
    knowsAbout: PERSON.knowsAbout[locale],
    ...(sameAs.length > 0 && { sameAs }),
  };
};

/**
 * Standalone Person schema (with `@context`). Emit on the home/CV page.
 *
 * @param locale - Language code ('tr' or 'en')
 */
export const createPersonSchema = (locale: Locale = 'tr') => ({
  '@context': 'https://schema.org',
  ...buildPerson(locale),
});

/**
 * Canonical WebSite reference node shared by every page's `isPartOf` — one
 * source of truth instead of per-page inline literals.
 *
 * @param locale - Language code ('tr' or 'en')
 */
export const createWebSiteRef = (locale: Locale = 'tr') => {
  const siteConfig = getSiteConfig(locale);
  return {
    '@type': 'WebSite',
    '@id': `${siteConfig.url}/#website`,
    name: siteConfig.name,
    url: siteConfig.url,
  };
};

/**
 * ProfilePage schema for the home/CV page. Embeds the full Person as
 * `mainEntity`, so the page is self-contained and the `@id` stays addressable
 * by other schema nodes.
 *
 * @param locale - Language code ('tr' or 'en')
 */
export const createProfilePageSchema = (locale: Locale = 'tr') => {
  const siteConfig = getSiteConfig(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${siteConfig.url}/#profilepage`,
    url: siteConfig.url,
    name: siteConfig.title,
    inLanguage: inLanguageTag(locale),
    isPartOf: createWebSiteRef(locale),
    mainEntity: buildPerson(locale),
  };
};

/**
 * Blog schema for the post listing page.
 *
 * The visible name/description are passed in rather than duplicated here —
 * `blog-i18n.ts` stays the single source of that copy.
 *
 * @param locale - Language code ('tr' or 'en')
 * @param copy   - The listing page's own heading and subtitle
 */
export const createBlogSchema = (locale: Locale = 'tr', copy: { name: string; description: string }) => {
  const siteConfig = getSiteConfig(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': blogId(siteConfig),
    url: absoluteUrl(siteConfig, '/blog'),
    name: copy.name,
    description: copy.description,
    inLanguage: inLanguageTag(locale),
    isPartOf: createWebSiteRef(locale),
    author: personRef(siteConfig),
    publisher: personRef(siteConfig),
  };
};

/**
 * BlogPosting schema for a single post. Tags ride along as `keywords` — the
 * one place they carry weight, since they are not a navigable taxonomy.
 *
 * @param meta   - The post's metadata, slug included
 * @param locale - Language code ('tr' or 'en')
 */
export const createBlogPostingSchema = (meta: BlogPostMeta, locale: Locale = 'tr') => {
  const siteConfig = getSiteConfig(locale);
  const seo = meta.seo[locale] ?? meta.seo.tr;
  const url = absoluteUrl(siteConfig, `/blog/${meta.slug}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#post`,
    url,
    mainEntityOfPage: url,
    headline: seo.title,
    description: seo.description,
    inLanguage: inLanguageTag(locale),
    datePublished: toISO(meta.kv.createdAt),
    dateModified: toISO(meta.kv.updatedAt),
    // A byline that names someone other than the site owner must not resolve to
    // the owner's Person node, or the schema would credit the wrong author.
    author:
      meta.author && meta.author !== siteConfig.author.name
        ? { '@type': 'Person', name: meta.author }
        : personRef(siteConfig),
    publisher: personRef(siteConfig),
    isPartOf: { '@id': blogId(siteConfig) },
    ...(seo.tags?.length ? { keywords: seo.tags } : {}),
    image: absoluteUrl(siteConfig, coverPath(meta, locale)),
  };
};
