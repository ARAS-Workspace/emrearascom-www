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
 * Blog-surface microcopy kept local to the blog components so the shared
 * translations bundle stays focused on site-wide chrome (nav / header /
 * footer). Everything here is UI copy for the blog list and post pages.
 */
export interface BlogStrings {
  pageTitle: string;
  pageSubtitle: string;
  readMore: string;
  empty: string;
  notFoundTitle: string;
  notFound: string;
  backToBlog: string;
  prevPage: string;
  nextPage: string;
  /** e.g. 'Sayfa 2 / 5' — rendered between the pager buttons. */
  pageStatus: (page: number, totalPages: number) => string;
}

export const blogStrings: Record<Locale, BlogStrings> = {
  tr: {
    pageTitle: 'Blog',
    pageSubtitle: 'Kişisel Yazılarım',
    readMore: 'Devamını Oku',
    empty: 'Henüz yayımlanmış bir yazı yok. Yakında burada olacak.',
    notFoundTitle: 'Yazı Bulunamadı',
    notFound: 'Bu yazı bulunamadı. Kaldırılmış ya da adresi değişmiş olabilir.',
    backToBlog: 'Tüm Yazılar',
    prevPage: 'Önceki',
    nextPage: 'Sonraki',
    pageStatus: (page, totalPages) => `Sayfa ${page} / ${totalPages}`,
  },
  en: {
    pageTitle: 'Blog',
    pageSubtitle: 'My Personal Writing',
    readMore: 'Read More',
    empty: 'No posts published yet. Check back soon.',
    notFoundTitle: 'Post Not Found',
    notFound: 'That post could not be found. It may have been removed or renamed.',
    backToBlog: 'All Posts',
    prevPage: 'Previous',
    nextPage: 'Next',
    pageStatus: (page, totalPages) => `Page ${page} of ${totalPages}`,
  },
};

export const getBlogStrings = (locale: Locale): BlogStrings => blogStrings[locale] ?? blogStrings.tr;
