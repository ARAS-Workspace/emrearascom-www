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

import { toISO } from '@shared/utils/date-helpers';
import type { Locale } from '@shared/translations';

const INTL_LOCALE: Record<Locale, string> = { tr: 'tr-TR', en: 'en-US' };

/**
 * Format a `meta.json` kv date ('DD/MM/YYYY HH:mm', Istanbul time) as a
 * localized long date, e.g. '23 Temmuz 2026' / 'July 23, 2026'.
 * Falls back to the raw string if the date can't be parsed.
 */
export const formatBlogDate = (kvDate: string, locale: Locale): string => {
  const date = new Date(toISO(kvDate));
  if (Number.isNaN(date.getTime())) return kvDate;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale] ?? 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

/**
 * Comparator for sorting posts newest-first by their kv `createdAt`.
 * ISO 8601 strings compare lexicographically in chronological order.
 */
export const byCreatedDesc = (a: string, b: string): number => toISO(b).localeCompare(toISO(a));
