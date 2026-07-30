import { activeLocales } from "@/i18n/config";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zakai-3uxj.vercel.app";

/**
 * hreflang alternates for a given path, one per active locale plus x-default.
 *
 * Only the homepage had this before — every other page either had no
 * `alternates` at all, or worse, a static `export const metadata` object
 * whose title and description were hardcoded Hebrew regardless of which
 * locale actually rendered. A search engine indexing /en/leaks saw a Hebrew
 * <title> tag; a French visitor's tab read "מרכז מסמכים — זכאי". This is the
 * one place that list of locales is written, so it can't drift from
 * i18n/config.ts's activeLocales the way sitemap.ts's copy once did.
 */
export function alternateLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of activeLocales) {
    languages[locale] = `${SITE_URL}/${locale}${path}`;
  }
  languages["x-default"] = `${SITE_URL}/he${path}`;
  return languages;
}
