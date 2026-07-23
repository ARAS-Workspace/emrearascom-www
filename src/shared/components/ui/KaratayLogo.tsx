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

import React from 'react';
import { useLocale } from '@shared/hooks';
import symbolLight from './assets/KaratayLogo/symbol/light.svg?raw';
import symbolDark from './assets/KaratayLogo/symbol/dark.svg?raw';
import textTr from './assets/KaratayLogo/text/tr.svg?raw';
import textEn from './assets/KaratayLogo/text/en.svg?raw';
import './styles/KaratayLogo.scss';

interface KaratayLogoProps {
  className?: string;
  /** Accessible name for the logo (the institution). */
  label?: string;
}

/**
 * KTO Karatay University wordmark, composed from two independent axes:
 *   • SYMBOL (the emblem) is theme-driven — a colour lockup on light, the
 *     university's all-white art on dark.
 *   • TEXT (the wordmark) is locale-driven — "…ÜNİVERSİTESİ" / "…UNIVERSITY" —
 *     and monochrome, so it just re-inks with the theme.
 *
 * Both symbol variants and both text variants are inlined; CSS reveals exactly
 * one of each (data-carbon-theme picks the symbol, data-locale picks the text),
 * which keeps it hydration-safe. The KTO Karatay marks belong to the university;
 * used here only to attribute the author's degree.
 */
const KaratayLogo: React.FC<KaratayLogoProps> = ({ className, label }) => {
  const { locale } = useLocale();
  return (
    <span
      className={`karatay-logo${className ? ` ${className}` : ''}`}
      data-locale={locale}
      role="img"
      aria-label={label}
    >
      <span
        className="karatay-logo__symbol karatay-logo__symbol--light"
        dangerouslySetInnerHTML={{ __html: symbolLight }}
      />
      <span
        className="karatay-logo__symbol karatay-logo__symbol--dark"
        dangerouslySetInnerHTML={{ __html: symbolDark }}
      />
      <span
        className="karatay-logo__text karatay-logo__text--tr"
        dangerouslySetInnerHTML={{ __html: textTr }}
      />
      <span
        className="karatay-logo__text karatay-logo__text--en"
        dangerouslySetInnerHTML={{ __html: textEn }}
      />
    </span>
  );
};

export default KaratayLogo;
