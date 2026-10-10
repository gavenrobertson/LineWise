// SPDX-License-Identifier: Apache-2.0
/**
 * i18n (NFR-I18N-01). Code calls t('key', 'English default'); the English
 * resource file is generated from those calls (scripts/extract-i18n.mjs) and
 * translators add new files in src/i18n/locales/<lang>.json — no code changes.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

const locales = import.meta.glob<{ default: Record<string, string> }>('./locales/*.json', { eager: true });

const resources: Record<string, { translation: Record<string, string> }> = { en: { translation: en } };
for (const [path, mod] of Object.entries(locales)) {
  const lang = /\/([\w-]+)\.json$/.exec(path)?.[1];
  if (lang && lang !== 'en') resources[lang] = { translation: mod.default };
}

export const LANGUAGES = Object.keys(resources);

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;

/** Locale-aware number and date formatting (NFR-I18N-02). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat(i18n.language).format(n);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}
