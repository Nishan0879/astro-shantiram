import { type ContentLocale, contentLocales } from "../db/schema.js";

/** Picks the requested language, falling back to English, Nepali, then Sanskrit. */
export function pickTranslation<T extends { locale: ContentLocale }>(
  translations: T[],
  locale: ContentLocale,
): T | undefined {
  const order = [locale, ...contentLocales.filter((l) => l !== locale)];
  for (const l of order) {
    const found = translations.find((t) => t.locale === l);
    if (found) return found;
  }
  return undefined;
}
