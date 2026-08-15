import type { Metadata } from "next";
import { activeLocales } from "@/i18n/config";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zakai-3uxj.vercel.app";

/** Dynamic share card (1200×630) — WhatsApp/Twitter previews. */
export function ogImageUrl(opts: {
  locale?: string;
  kicker?: string;
  sub?: string;
  amount?: string;
}): string {
  const params = new URLSearchParams();
  params.set("locale", opts.locale ?? "he");
  params.set("kicker", (opts.kicker ?? "ZAKAI").slice(0, 60));
  const sub = opts.sub?.trim();
  if (sub) params.set("sub", sub.slice(0, 90));
  const amount = opts.amount?.trim();
  if (amount) params.set("amount", amount.slice(0, 40));
  return `${SITE_URL}/api/og?${params.toString()}`;
}

export function defaultOpenGraph(
  locale: string,
  opts: { title: string; description: string; path: string },
): Metadata["openGraph"] {
  const url = `${SITE_URL}/${locale}${opts.path}`;
  const image = ogImageUrl({ locale, sub: opts.description });
  return {
    type: "website",
    siteName: "ZAKAI",
    title: opts.title,
    description: opts.description,
    url,
    images: [{ url: image, width: 1200, height: 630, alt: opts.title }],
  };
}

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
/**
 * Metadata for a page that must never be indexed.
 *
 * A dashboard, a settings screen, a one-time confirmation link — these still
 * need a title, because a browser tab reading "zakai-3uxj.vercel.app" is what
 * a person sees when they have six tabs open and are looking for the one with
 * their money in it. What they must not have is a description written for a
 * search engine that is never going to see them.
 */
export function privatePageMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}

/**
 * Metadata for a public page: unique title, real description, share card,
 * canonical URL and hreflang alternates — the five things that were missing
 * one-by-one across twenty-one pages, each in a slightly different way.
 */
export function publicPageMetadata(
  locale: string,
  opts: { title: string; description: string; path: string },
): Metadata {
  return {
    title: opts.title,
    description: opts.description,
    alternates: {
      canonical: `${SITE_URL}/${locale}${opts.path}`,
      languages: alternateLanguages(opts.path),
    },
    openGraph: defaultOpenGraph(locale, opts),
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [ogImageUrl({ locale, sub: opts.description })],
    },
  };
}

export function alternateLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of activeLocales) {
    languages[locale] = `${SITE_URL}/${locale}${path}`;
  }
  languages["x-default"] = `${SITE_URL}/he${path}`;
  return languages;
}
