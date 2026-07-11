/**
 * i18n configuration.
 *
 * Hebrew is the primary, default locale and ships fully translated. The other
 * locales are wired into the architecture from day one (per spec) so that
 * adding a language is a translation task, never a rewrite. Only Hebrew is
 * marked `active`; inactive locales fall back to Hebrew messages until their
 * catalog is complete.
 */
export const locales = ["he", "en", "ar", "ru"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "he";

/** Locales whose catalogs are complete enough to expose in the UI switcher. */
export const activeLocales: Locale[] = ["he", "en"];

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
  ar: "AR",
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
