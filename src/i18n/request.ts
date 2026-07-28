import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale =
    requested && isLocale(requested) ? requested : defaultLocale;

  // Fall back along a chain, not to a single default.
  //
  // Everything used to fall back to Hebrew, which is right for Arabic — a
  // reader in Israel is far better served by Hebrew than by English for a
  // string we have not translated yet — and wrong for Russian, where Hebrew is
  // simply unreadable and English is not. A single global default cannot be
  // correct for both, and the cost of getting it wrong lands entirely on the
  // group least able to work around it.
  //
  // Ordered nearest-useful-first, and every chain ends at Hebrew because that
  // is the only catalogue guaranteed complete.
  const FALLBACKS: Record<Locale, Locale[]> = {
    he: [],
    en: ["he"],
    ar: ["he", "en"],
    ru: ["en", "he"],
  };

  const layers = await Promise.all(
    [...FALLBACKS[locale]].reverse().map(async (l) => (await import(`../messages/${l}.json`)).default),
  );
  const primary = (await import(`../messages/${locale}.json`)).default;
  const messages = [...layers, primary].reduce(
    (acc, layer) => deepMerge(acc, layer),
    {} as Record<string, unknown>,
  );

  return {
    locale,
    messages,
  };
});

function deepMerge<T extends Record<string, unknown>>(base: T, override: T): T {
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const b = base[key];
    const o = override[key];
    if (isObject(b) && isObject(o)) {
      out[key] = deepMerge(b, o);
    } else if (o !== undefined) {
      out[key] = o;
    }
  }
  return out as T;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
