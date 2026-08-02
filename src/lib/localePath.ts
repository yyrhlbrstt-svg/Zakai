import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

const LOCALE_PREFIX = /^\/(he|en|ar|ru|de|fr)(\/|$)/;

/** UI locale from signup country (IL-first; no per-user locale column yet). */
export function localeForCountry(country?: string | null): Locale {
  if (!country || country === "IL") return "he";
  if (country === "DE") return "de";
  if (country === "FR") return "fr";
  if (["SA", "AE", "EG", "JO"].includes(country)) return "ar";
  if (country === "RU" || country === "UA") return "ru";
  return "en";
}

/**
 * Prefix a path with the locale segment when missing.
 * Supports query strings: `/dashboard?case=1` → `/he/dashboard?case=1`.
 */
export function localePath(locale: Locale, pathname: string): string {
  const raw = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const q = raw.indexOf("?");
  const pathOnly = q === -1 ? raw : raw.slice(0, q);
  const query = q === -1 ? "" : raw.slice(q);
  if (LOCALE_PREFIX.test(pathOnly)) return raw;
  const loc = isLocale(locale) ? locale : defaultLocale;
  return `/${loc}${pathOnly === "/" ? "" : pathOnly}${query}`;
}

export function absoluteLocaleUrl(
  baseUrl: string,
  locale: Locale,
  pathname: string,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${localePath(locale, pathname)}`;
}
