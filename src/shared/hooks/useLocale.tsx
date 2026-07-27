import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale, translations } from '@shared/translations';

interface LocaleContextValue {
  locale: Locale;
  changeLocale: (newLocale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>(() => {
    // `Object.hasOwn`, not `in`: every candidate below is attacker-supplied, and
    // `in` walks the prototype chain — `?locale=constructor` would be accepted
    // as a locale, `translate` would hand back `Object` instead of a bundle
    // (truthy, so its own fallback never fires) and the first string lookup
    // would take the page down.
    const isKnownLocale = (value: string): boolean => Object.hasOwn(translations, value);

    try {
      // 1. URL parameter (pre-rendering control)
      const urlLocale = new URLSearchParams(window.location.search).get('locale');
      if (urlLocale && isKnownLocale(urlLocale)) return urlLocale as Locale;

      // 2. Cookie (user explicit choice - persistent)
      const cookieLocale = document.cookie.match(/preferred_locale=(\w+)/)?.[1];
      if (cookieLocale && isKnownLocale(cookieLocale)) return cookieLocale as Locale;

      // 3. HTML lang attribute (server/worker decision)
      const htmlLang = document.documentElement.getAttribute('lang');
      if (htmlLang && isKnownLocale(htmlLang)) return htmlLang as Locale;

      // 4. Browser language fallback
      const browserLang = navigator.language.split('-')[0];
      if (isKnownLocale(browserLang)) return browserLang as Locale;

      // 5. Default
      return DEFAULT_LOCALE;
    } catch {
      return DEFAULT_LOCALE;
    }
  });

  document.documentElement.lang = locale;

  const changeLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    document.documentElement.lang = newLocale;
    try {
      const maxAge = 60 * 60 * 24 * 365;
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `preferred_locale=${newLocale}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
    } catch (error) {
      console.warn('Failed to set cookie:', error);
    }
  }, []);

  const value = useMemo(() => ({ locale, changeLocale }), [locale, changeLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
};
