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
import signatureMarkup from './assets/SignatureComponent/signature.svg?raw';
import './styles/SignatureComponent.scss';

interface SignatureComponentProps {
  className?: string;
}

/**
 * The site owner's handwritten signature — outlined from the licensed "Santorini"
 * typeface (CreativeMarket). The glyph artwork is a personal mark and is NOT
 * covered by the source license above.
 *
 * Inlined (like KaratayLogo) so it re-inks with the theme: the SVG paints in
 * `currentColor`, which CSS binds to `--cds-text-primary` (near-black on light,
 * near-white on dark). Lighter than KaratayLogo — a single monochrome asset,
 * no locale/theme variants. Decorative: the name is already the page's <h1>,
 * so it is aria-hidden.
 */
const SignatureComponent: React.FC<SignatureComponentProps> = ({ className }) => (
  <span
    className={`signature${className ? ` ${className}` : ''}`}
    aria-hidden="true"
    dangerouslySetInnerHTML={{ __html: signatureMarkup }}
  />
);

export default SignatureComponent;
