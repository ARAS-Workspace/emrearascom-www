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
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Content,
  Header,
  HeaderContainer,
  HeaderName,
  HeaderMenuButton,
  HeaderNavigation,
  HeaderMenuItem,
  HeaderGlobalBar,
  HeaderGlobalAction,
  HeaderSideNavItems,
  SkipToContent,
  SideNav,
  SideNavItems,
} from '@carbon/react';
import { Asleep, Light, RotateClockwise } from '@carbon/icons-react';

import { useTheme } from '@shared/hooks/useTheme';
import { useLocale } from '@shared/hooks/useLocale';
import { translate } from '@shared/translations';
import FlagIcon from '@shared/components/ui/FlagIcon';
import Footer from './Footer';

import './styles/BlogLayout.scss';
import '../ui/styles/ThemeSwitcher.scss';

interface RenderProps {
  isSideNavExpanded: boolean;
  onClickSideNavExpand: () => void;
}

const BlogLayout: React.FC = () => {
  const { theme, toggleTheme, isThemeTransitioning } = useTheme();
  const { locale, changeLocale } = useLocale();
  const location = useLocation();
  const navigate = useNavigate();
  const t = translate(locale);

  const navItems = [
    { label: t.nav.home, href: '/' },
  ];

  // Normalize trailing slash for consistent comparison.
  const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
  const isActive = (href: string) =>
    href === '/'
      ? normalizedPath === '/'
      : normalizedPath === href || normalizedPath.startsWith(`${href}/`);

  const go = (e: React.MouseEvent, href: string, close?: () => void) => {
    e.preventDefault();
    navigate(href);
    close?.();
  };

  const handleLocaleToggle = () => changeLocale(locale === 'en' ? 'tr' : 'en');

  return (
    <HeaderContainer
      render={({ isSideNavExpanded, onClickSideNavExpand }: RenderProps) => (
        <>
          <Header aria-label={t.header.appName}>
            <SkipToContent href="#main-content" />

            <HeaderMenuButton
              aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
              onClick={onClickSideNavExpand}
              isActive={isSideNavExpanded}
            />

            <HeaderName href="/" prefix="" onClick={(e: React.MouseEvent) => go(e, '/')}>
              {t.header.appName}
            </HeaderName>

            {/* Desktop — top navigation */}
            <HeaderNavigation aria-label={t.header.appName}>
              {navItems.map((item) => (
                <HeaderMenuItem
                  key={item.href}
                  href={item.href}
                  isActive={isActive(item.href)}
                  onClick={(e: React.MouseEvent) => go(e, item.href)}
                >
                  {item.label}
                </HeaderMenuItem>
              ))}
            </HeaderNavigation>

            <HeaderGlobalBar>
              <HeaderGlobalAction
                aria-label={theme === 'white' ? t.header.darkMode : t.header.lightMode}
                onClick={toggleTheme}
                className={`theme-switcher${isThemeTransitioning ? ' theme-transitioning' : ''}`}
                tooltipAlignment="end"
              >
                {isThemeTransitioning ? (
                  <RotateClockwise size={20} className="spinner-icon" />
                ) : theme === 'white' ? (
                  <Asleep size={20} />
                ) : (
                  <Light size={20} />
                )}
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label={t.language.switchTo}
                onClick={handleLocaleToggle}
                tooltipAlignment="end"
              >
                <FlagIcon locale={locale === 'en' ? 'tr' : 'en'} size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>

            {/* Mobile — overlay side navigation mirroring the top nav.
                isPersistent={false} → the nav collapses to 0-width on every
                breakpoint (class `--hidden`) and only opens as an overlay when
                the hamburger sets `expanded`; without it Carbon's `--ux` rail
                stays a persistent 256px panel on desktop and overlaps content. */}
            <SideNav
              aria-label="Navigation"
              expanded={isSideNavExpanded}
              onSideNavBlur={onClickSideNavExpand}
              isPersistent={false}
            >
              <SideNavItems>
                <HeaderSideNavItems>
                  {navItems.map((item) => (
                    <HeaderMenuItem
                      key={`mobile-${item.href}`}
                      href={item.href}
                      isActive={isActive(item.href)}
                      onClick={(e: React.MouseEvent) => go(e, item.href, onClickSideNavExpand)}
                    >
                      {item.label}
                    </HeaderMenuItem>
                  ))}
                </HeaderSideNavItems>
              </SideNavItems>
            </SideNav>
          </Header>

          <Content id="main-content" className="blog-shell">
            <Outlet />
          </Content>

          <Footer />
        </>
      )}
    />
  );
};

export default BlogLayout;
