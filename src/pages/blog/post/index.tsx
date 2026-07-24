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
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@carbon/react';
import { ArrowLeft, WarningAlt } from '@carbon/icons-react';

import { useLocale } from '@shared/hooks';
import SEO from '@shared/components/content/SEO';
import BlogPost from '@shared/components/blog/BlogPost';
import DinoGame from '@shared/components/games/DinoGame';
import { getBlogStrings } from '@shared/components/blog/blog-i18n';
import { getPost } from '@shared/components/blog/posts';
// Reuse the error pages' visual language (error-code / error-title / error-game
// -area / error-actions) so a missing post feels like the site's 404, not a
// bare line of text.
import '@shared/pages/error/styles/common.scss';
import './styles/BlogPostPage.scss';

/**
 * The one component behind every `/blog/:slug` URL.
 *
 * It resolves the slug against the content registry rather than being
 * generated per post — which is what lets a new post be a pure filesystem
 * addition with no router edit. The build side expands the same directory
 * listing into concrete prerendered routes, so an unknown slug only ever
 * happens on a hand-typed or stale URL.
 */
const BlogPostPage: React.FC = () => {
  const { slug } = useParams();
  const { locale } = useLocale();
  const navigate = useNavigate();
  const s = getBlogStrings(locale);
  const meta = getPost(slug);

  if (!meta) {
    // Styled like the shared 404, with the Dino easter egg — but inside the
    // blog layout (header + footer stay), so the container isn't full-height.
    return (
      <>
        <SEO title={s.notFoundTitle} description={s.notFound} noIndex />
        <section className="blog-post-missing">
          <div className="error-page-content">
            <div className="error-icon-wrapper">
              <WarningAlt className="error-icon" />
            </div>
            <h1 className="error-code">404</h1>
            <h2 className="error-title">{s.notFoundTitle}</h2>
            <p className="error-description">{s.notFound}</p>

            <div className="error-game-area">
              <DinoGame.Lazy theme="dpi-phantom" />
            </div>

            <div className="error-actions">
              <Button renderIcon={ArrowLeft} size="lg" onClick={() => navigate('/blog')}>
                {s.backToBlog}
              </Button>
            </div>
          </div>
        </section>
      </>
    );
  }

  return <BlogPost meta={meta} />;
};

export default BlogPostPage;
