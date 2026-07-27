/**
 * i18n configuration.
 *
 * Hebrew is the primary, default locale. English, Arabic and Russian are active
 * in the UI switcher. Incomplete catalog keys deep-merge from Hebrew via
 * `request.ts` so a partial translation never crashes the page.
 */
export const locales = ["he", "en", "ar", "ru"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "he";

/** Locales exposed in the UI language switcher. */
export const activeLocales: Locale[] = ["he", "en", "ar", "ru"];

/** Text direction per locale. */
export const dir: Record<Locale, "rtl" | "ltr"> = {
  he: "rtl",
  ar: "rtl",
  en: "ltr",
  ru: "ltr",
};

export const localeLabel: Record<Locale, string> = {
  he: "עב",
  en: "EN",
  ar: "ع",
  ru: "RU",
};

/** BCP-47 locale used for number/date formatting. */
export const bcp47: Record<Locale, string> = {
  he: "he-IL",
  en: "en-GB",
  ar: "ar-IL",
  ru: "ru-RU",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
