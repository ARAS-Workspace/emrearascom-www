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

import type { Locale } from '@shared/translations';

/**
 * Top navigation.
 *
 * The labels live here rather than in the translation bundles: a nav entry is
 * a route plus its names, and splitting those across two files means adding a
 * page touches both. Everything the header and the mobile side nav need to
 * render an item is in one literal.
 */

interface NavItem {
  /** Route this item points at. */
  href: string;
  /** Per-locale label. */
  label: Record<Locale, string>;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: { tr: 'Ana Sayfa', en: 'Home' } },
  { href: '/blog', label: { tr: 'Blog', en: 'Blog' } },
  { href: '/ai', label: { tr: 'AI', en: 'AI' } },
] as const;

/**
 * Nav items resolved to one language.
 * @example const items = getNavItems(locale);
 */
export const getNavItems = (locale: Locale): { href: string; label: string }[] =>
  NAV_ITEMS.map((item) => ({ href: item.href, label: item.label[locale] ?? item.label.tr }));
