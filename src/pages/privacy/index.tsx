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

import React, { Suspense, lazy } from 'react';

import { useLocale } from '@shared/hooks';
import SEO from '@shared/components/content/SEO';
import LoadingSpinner from '@shared/components/ui/LoadingSpinner';
import MDXPageRenderer from '@shared/components/content/MDXPageRenderer';

import metaEn from './meta/en.json';
import metaTr from './meta/tr.json';

/**
 * The privacy notice.
 *
 * MDX per locale, like every other page, which here matters more than usual:
 * the llms pipeline reads the same source the visitor does, so the notice an
 * agent quotes and the notice a person reads cannot drift apart.
 */
const META_MAP = { tr: metaTr, en: metaEn };

const BODY_MAP = {
  tr: lazy(() => import('./index.mdx')),
  en: lazy(() => import('./index.en.mdx')),
} as const;

const PrivacyPage: React.FC = () => {
  const { locale } = useLocale();
  const meta = META_MAP[locale] ?? META_MAP.tr;
  const Body = BODY_MAP[locale] ?? BODY_MAP.tr;

  return (
    <>
      <SEO {...meta.seo} path="/privacy" />

      <Suspense fallback={<LoadingSpinner />}>
        <MDXPageRenderer content={Body} />
      </Suspense>
    </>
  );
};

export default PrivacyPage;
