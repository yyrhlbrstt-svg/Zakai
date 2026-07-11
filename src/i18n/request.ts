import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale =
    requested && isLocale(requested) ? requested : defaultLocale;

  // Load the requested catalog, falling back to Hebrew for any locale whose
  // catalog is not yet complete. Deep-merge keeps partially-translated locales
  // usable without missing-key crashes.
  const primary = (await import(`../messages/${locale}.json`)).default;
  const fallback =
    locale === defaultLocale
      ? primary
      : (await import(`../messages/${defaultLocale}.json`)).default;

  return {
    locale,
    messages: deepMerge(fallback, primary),
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
