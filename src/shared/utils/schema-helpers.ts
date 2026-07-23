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

// ============================================================================
// Helpers
// ============================================================================

/** BCP-47 language tag for schema `inLanguage` fields. */
const inLanguageTag = (locale: Locale): string => (locale === 'tr' ? 'tr-TR' : 'en-US');

/** Stable `@id` of the single Person node this whole site revolves around. */
const personId = (siteConfig: SiteConfig): string => `${siteConfig.url}/#person`;

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
