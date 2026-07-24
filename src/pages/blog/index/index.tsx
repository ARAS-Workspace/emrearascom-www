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
import { Grid, Column, Button } from '@carbon/react';
import { ArrowLeft, ArrowRight } from '@carbon/icons-react';
import { useSearchParams } from 'react-router-dom';

import { useLocale } from '@shared/hooks';
import SEO from '@shared/components/content/SEO';
import PostCard from '@shared/components/blog/PostCard';
import { getBlogStrings } from '@shared/components/blog/blog-i18n';
import { posts } from '@shared/components/blog/posts';
import { createBlogSchema } from '@shared/utils/schema-helpers';
import './styles/BlogIndex.scss';

const POSTS_PER_PAGE = 10;

/**
 * Paging lives in the query string rather than in the route, so it costs no
 * extra prerendered pages (a `/blog/page/2` route would multiply by locale ×
 * theme). Deep links still work, and crawlers reach every post directly from
 * the sitemap, so nothing is hidden behind the pager.
 */
const BlogIndex: React.FC = () => {
  const { locale } = useLocale();
  const s = getBlogStrings(locale);
  const [searchParams, setSearchParams] = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const requested = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isNaN(requested) ? 1 : Math.min(Math.max(requested, 1), totalPages);
  const visible = posts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  // Copy the existing params so `?locale=` (and anything added later) survives.
  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    if (next <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(next));
    }
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <SEO
        title={s.pageTitle}
        description={s.pageSubtitle}
        path="/blog"
        schemas={[createBlogSchema(locale, { name: s.pageTitle, description: s.pageSubtitle })]}
      />

      <section className="blog-index">
        <Grid className="blog-index__grid">
          <Column lg={12} md={8} sm={4}>
            <header className="blog-index__header">
              <h1 className="blog-index__title">{s.pageTitle}</h1>
              <p className="blog-index__subtitle">{s.pageSubtitle}</p>
            </header>

            {visible.length > 0 ? (
              <div className="blog-index__list">
                {visible.map((post) => (
                  <PostCard key={post.slug} meta={post} />
                ))}
              </div>
            ) : (
              <p className="blog-index__empty">{s.empty}</p>
            )}

            {totalPages > 1 && (
              <nav className="blog-index__pager" aria-label={s.pageTitle}>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={ArrowLeft}
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  {s.prevPage}
                </Button>
                <span className="blog-index__pager-status">{s.pageStatus(page, totalPages)}</span>
                <Button
                  kind="ghost"
                  size="sm"
                  renderIcon={ArrowRight}
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  {s.nextPage}
                </Button>
              </nav>
            )}
          </Column>
        </Grid>
      </section>
    </>
  );
};

export default BlogIndex;
