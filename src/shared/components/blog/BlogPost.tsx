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

import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Column, Tag, Button } from '@carbon/react';
import { Calendar, UserAvatar, ArrowLeft } from '@carbon/icons-react';

import { useLocale } from '@shared/hooks';
import { getSiteConfig } from '@shared/config/seoConfig';
import SEO from '@shared/components/content/SEO';
import MDXPageRenderer from '@shared/components/content/MDXPageRenderer';
import LoadingSpinner from '@shared/components/ui/LoadingSpinner';
import { coverPath, createBlogPostingSchema, type BlogPostMeta } from '@shared/utils/schema-helpers';
import { toISO } from '@shared/utils/date-helpers';
import { formatBlogDate } from './blog-helpers';
import { getBlogStrings } from './blog-i18n';
import { getPostBody } from './posts';
import './styles/BlogPost.scss';

export interface BlogPostProps {
  meta: BlogPostMeta;
}

const BlogPost: React.FC<BlogPostProps> = ({ meta }) => {
  const { locale } = useLocale();
  const navigate = useNavigate();
  const s = getBlogStrings(locale);
  const seo = meta.seo[locale] ?? meta.seo.tr;
  const Body = getPostBody(meta.slug, locale);

  // Posts are attributed to the site owner unless the byline says otherwise.
  const author = meta.author ?? getSiteConfig(locale).author.name;

  return (
    <>
      <SEO
        type="article"
        title={seo.title}
        description={seo.description}
        path={`/blog/${meta.slug}`}
        image={coverPath(meta, locale)}
        schemas={[createBlogPostingSchema(meta, locale)]}
      />

      <article className="blog-post">
        <Grid className="blog-post__head">
          <Column lg={16} md={8} sm={4}>
            <Button
              kind="ghost"
              size="sm"
              renderIcon={ArrowLeft}
              className="blog-post__back"
              onClick={() => navigate('/blog')}
            >
              {s.backToBlog}
            </Button>

            <h1 className="blog-post__title">{seo.title}</h1>

            <div className="blog-post__meta">
              <span className="blog-post__meta-item">
                <Calendar size={16} />
                <time dateTime={toISO(meta.kv.createdAt)}>
                  {formatBlogDate(meta.kv.createdAt, locale)}
                </time>
              </span>
              <span className="blog-post__meta-item">
                <UserAvatar size={16} />
                {author}
              </span>
            </div>

            {(seo.tags ?? []).length > 0 && (
              <div className="blog-post__tags">
                {seo.tags.map((tag) => (
                  <Tag key={tag} type="cool-gray" size="sm">
                    {tag}
                  </Tag>
                ))}
              </div>
            )}
          </Column>
        </Grid>

        <div className="blog-post__body">
          {Body && (
            <Suspense fallback={<LoadingSpinner fullpage />}>
              <MDXPageRenderer content={Body} />
            </Suspense>
          )}
        </div>
      </article>
    </>
  );
};

export default BlogPost;
