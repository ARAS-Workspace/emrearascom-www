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
import { Link } from 'react-router-dom';
import { Tag } from '@carbon/react';
import { Calendar, ArrowRight } from '@carbon/icons-react';

import { useLocale } from '@shared/hooks';
import type { BlogPostMeta } from '@shared/utils/schema-helpers';
import { toISO } from '@shared/utils/date-helpers';
import { formatBlogDate } from './blog-helpers';
import { getBlogStrings } from './blog-i18n';
import './styles/PostCard.scss';

export interface PostCardProps {
  meta: BlogPostMeta;
}

const PostCard: React.FC<PostCardProps> = ({ meta }) => {
  const { locale } = useLocale();
  const s = getBlogStrings(locale);
  const seo = meta.seo[locale] ?? meta.seo.tr;

  return (
    <article className="post-card">
      <Link to={`/blog/${meta.slug}`} className="post-card__link">
        <div className="post-card__date">
          <Calendar size={16} />
          <time dateTime={toISO(meta.kv.createdAt)}>
            {formatBlogDate(meta.kv.createdAt, locale)}
          </time>
        </div>

        <h3 className="post-card__title">{seo.title}</h3>
        <p className="post-card__excerpt">{seo.description}</p>

        {/* Tags are labels, not links — the site has no tag taxonomy. */}
        {(seo.tags ?? []).length > 0 && (
          <div className="post-card__tags">
            {seo.tags.map((tag) => (
              <Tag key={tag} type="cool-gray" size="sm">
                {tag}
              </Tag>
            ))}
          </div>
        )}

        <span className="post-card__cta">
          {s.readMore}
          <ArrowRight size={16} />
        </span>
      </Link>
    </article>
  );
};

export default PostCard;
