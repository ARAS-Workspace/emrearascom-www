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

import React, { useMemo } from 'react';
import { Grid, Column, ClickableTile, Tag, Link } from '@carbon/react';
import { LogoGithub, LogoLinkedin, Email, ArrowUpRight, Launch } from '@carbon/icons-react';
import type { CarbonIconType } from '@carbon/icons-react';

import SEO from '@shared/components/content/SEO';
import SignatureComponent from '@shared/components/ui/SignatureComponent';
import KaratayLogo from '@shared/components/ui/KaratayLogo';
import PgpKey from '@shared/components/ui/PgpKey';
import DinoGame from '@shared/components/games/DinoGame';
import { useLocale } from '@shared/hooks';
import { createPersonSchema, createProfilePageSchema } from '@shared/utils/schema-helpers';

import homeTr from './data/sections/tr/home.json';
import homeEn from './data/sections/en/home.json';
import './styles/main.scss';

interface CtaLink {
  label: string;
  href: string;
  icon?: string;
  external?: boolean;
}

interface ProjectItem {
  name: string;
  description: string;
  href: string;
  tags: string[];
  external?: boolean;
}

interface Publication {
  title: string;
  authors: string;
  venue: string;
  year: string;
}

interface AcademicContent {
  title: string;
  author: string;
  profile: { label: string; href: string };
  publications: Publication[];
}

interface EducationItem {
  school: string;
  degree: string;
  level: string;
  period: string;
  logo: string;
}

interface HomeContent {
  intro: { role: string; name: string; summary: string; links: CtaLink[] };
  projects: { title: string; items: ProjectItem[] };
  academics: AcademicContent;
  education: { title: string; items: EducationItem[] };
  skills: { title: string; items: string[] };
  contact: { title: string; description: string; links: CtaLink[] };
}

const CONTENT_MAP: Record<'tr' | 'en', HomeContent> = {
  tr: homeTr as HomeContent,
  en: homeEn as HomeContent,
};

const ICON_MAP: Record<string, CarbonIconType> = {
  github: LogoGithub,
  linkedin: LogoLinkedin,
  email: Email,
};

// Institution logos, resolved by the education item's `logo` key (same idea as
// ICON_MAP) — each logo is its own theme/locale-aware component.
const LOGO_MAP: Record<string, React.FC<{ className?: string; label?: string }>> = {
  karatay: KaratayLogo,
};

const renderLinks = (links: CtaLink[], extra?: React.ReactNode) => (
  <div className="home-links">
    {links.map((link) => (
      <Link
        key={link.href}
        href={link.href}
        className="home-link"
        renderIcon={link.icon ? ICON_MAP[link.icon] : undefined}
        {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {link.label}
      </Link>
    ))}
    {extra}
  </div>
);

// Bold the site owner's own name inside a publication's author list (each list
// contains it exactly once), leaving the co-authors as plain text.
const renderAuthors = (authors: string, self: string): React.ReactNode => {
  const idx = authors.indexOf(self);
  if (idx === -1) return authors;
  return (
    <>
      {authors.slice(0, idx)}
      <strong className="home-publication__self">{self}</strong>
      {authors.slice(idx + self.length)}
    </>
  );
};

const HomePage: React.FC = () => {
  const { locale } = useLocale();
  const content = CONTENT_MAP[locale] || CONTENT_MAP.en;

  const schemas = useMemo(
    () => [createPersonSchema(locale), createProfilePageSchema(locale)],
    [locale],
  );

  return (
    <>
      <SEO schemas={schemas} />

      <section className="home-page">
        <Grid className="home-grid">
          {/* Intro / CV header */}
          <Column lg={16} md={8} sm={4} className="home-intro">
            <p className="home-intro__eyebrow">{content.intro.role}</p>
            <h1 className="home-intro__name">{content.intro.name}</h1>
            <p className="home-intro__summary">{content.intro.summary}</p>
            {renderLinks(content.intro.links, <PgpKey />)}
            <SignatureComponent className="home-intro__signature" />
          </Column>

          {/* Featured projects */}
          <Column lg={16} md={8} sm={4} className="home-section">
            <h2 className="home-section__title">{content.projects.title}</h2>
            <div className="home-projects">
              {content.projects.items.map((project) => (
                <ClickableTile
                  key={project.href}
                  className="home-project-tile"
                  href={project.href}
                  {...(project.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <div className="home-project-tile__head">
                    <h3 className="home-project-tile__name">{project.name}</h3>
                    <ArrowUpRight size={20} className="home-project-tile__arrow" />
                  </div>
                  <p className="home-project-tile__desc">{project.description}</p>
                  <div className="home-project-tile__tags">
                    {project.tags.map((tag) => (
                      <Tag key={tag} type="cool-gray" size="sm" className="home-project-tile__tag">
                        {tag}
                      </Tag>
                    ))}
                  </div>
                </ClickableTile>
              ))}
            </div>
          </Column>

          {/* Academic work */}
          <Column lg={16} md={8} sm={4} className="home-section">
            <h2 className="home-section__title">{content.academics.title}</h2>
            <ul className="home-publications">
              {content.academics.publications.map((pub) => (
                <li key={pub.title} className="home-publication">
                  <h3 className="home-publication__title">{pub.title}</h3>
                  <p className="home-publication__authors">
                    {renderAuthors(pub.authors, content.academics.author)}
                  </p>
                  <p className="home-publication__venue">
                    {pub.venue} · {pub.year}
                  </p>
                </li>
              ))}
            </ul>
            <Link
              href={content.academics.profile.href}
              className="home-link home-scholar-link"
              renderIcon={Launch}
              target="_blank"
              rel="noopener noreferrer"
            >
              {content.academics.profile.label}
            </Link>
          </Column>

          {/* Education */}
          <Column lg={16} md={8} sm={4} className="home-section">
            <h2 className="home-section__title">{content.education.title}</h2>
            {content.education.items.map((edu) => {
              const Logo = LOGO_MAP[edu.logo];
              return (
                <div key={edu.school} className="home-education">
                  {Logo && <Logo className="home-education__logo" label={edu.school} />}
                  <div className="home-education__body">
                    <p className="home-education__degree">{edu.degree}</p>
                    <p className="home-education__meta">
                      {edu.level} · {edu.period}
                    </p>
                  </div>
                </div>
              );
            })}
          </Column>

          {/* Skills */}
          <Column lg={16} md={8} sm={4} className="home-section">
            <h2 className="home-section__title">{content.skills.title}</h2>
            <div className="home-skills">
              {content.skills.items.map((skill) => (
                <Tag key={skill} type="blue" size="md">
                  {skill}
                </Tag>
              ))}
            </div>
          </Column>

          {/* Contact */}
          <Column lg={16} md={8} sm={4} className="home-section">
            <h2 className="home-section__title">{content.contact.title}</h2>
            <p className="home-contact__desc">{content.contact.description}</p>
            {renderLinks(content.contact.links)}
          </Column>
        </Grid>

        {/* Easter egg — the Phantom-ghost runner, unlabeled at the very bottom,
            right below contact (Phantom quickstart preset: theme="dpi-phantom"). */}
        <div className="home-easter-egg">
          <DinoGame.Lazy theme="dpi-phantom" />
        </div>
      </section>
    </>
  );
};

export default HomePage;
