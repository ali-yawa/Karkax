import React, { createContext, useContext, useEffect, useState } from 'react';
import ug from './locales/ug.json';
import ar from './locales/ar.json';
import tr from './locales/tr.json';
import zh from './locales/zh.json';
import en from './locales/en.json';

export type LanguageCode = 'ug' | 'ar' | 'tr' | 'zh' | 'en';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  dir: 'rtl' | 'ltr';
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'ug', name: 'ئۇيغۇرچە', dir: 'rtl' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'tr', name: 'Türkçe', dir: 'ltr' },
  { code: 'zh', name: '中文', dir: 'ltr' },
  { code: 'en', name: 'English', dir: 'ltr' },
];

export type TranslationDict = typeof ug;
export type TranslationKey = keyof TranslationDict;

export const LOCALE_BUNDLES: Record<LanguageCode, TranslationDict> = {
  ug,
  ar,
  tr,
  zh,
  en,
};

interface I18nContextValue {
  language: LanguageCode;
  dir: 'rtl' | 'ltr';
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<LanguageCode>('ug');

  const currentLang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  useEffect(() => {
    document.documentElement.lang = currentLang.code;
    document.documentElement.dir = currentLang.dir;
  }, [currentLang]);

  const t = (key: TranslationKey): string => {
    return LOCALE_BUNDLES[language][key] ?? LOCALE_BUNDLES.en[key] ?? key;
  };

  return (
    <I18nContext.Provider
      value={{
        language,
        dir: currentLang.dir,
        setLanguage,
        t,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used inside I18nProvider');
  }
  return ctx;
}
