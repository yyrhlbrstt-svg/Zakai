/**
 * i18n configuration.
 *
 * Hebrew is the primary, default locale. English, Arabic, Russian, German and
 * French are active in the UI switcher. Incomplete catalog keys deep-merge
 * from a fallback chain via `request.ts` so a partial translation never
 * crashes the page. German and French cover the DE and FR jurisdiction packs
 * (`src/lib/global/packs`) — the money-recovery letters those packs generate
 * were already correct in German/French; the site chrome around them was not,
 * because no German or French UI locale existed at all.
 */
export const locales = ["he", "en", "ar", "ru", "de", "fr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "he";

/** Locales exposed in the UI language switcher. */
export const activeLocales: Locale[] = ["he", "en", "ar", "ru", "de", "fr"];

/** Text direction per locale. */
export const dir: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  ar: "rtl",
  en: "ltr",
  ru: "ltr",
  de: "ltr",
  fr: "ltr",
};

export const localeLabel: Record<Locale, string> = {
  he: "עב",
  en: "EN",
  ar: "ع",
  ru: "RU",
  de: "DE",
  fr: "FR",
};

/** BCP-47 locale used for number/date formatting. */
export const bcp47: Record<Locale, string> = {
  he: "he-IL",
  en: "en-GB",
  ar: "ar-IL",
  ru: "ru-RU",
  de: "de-DE",
  fr: "fr-FR",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
