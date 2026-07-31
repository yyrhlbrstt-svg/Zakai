/**
 * Root layout — exists only so Next.js has a root layout file at all.
 *
 * Every real route lives under `[locale]/layout.tsx`, which supplies the
 * actual `<html>`/`<body>` (locale, dir, fonts, providers). This one must NOT
 * also render `<html>`/`<body>` — that would double them up for every normal
 * page. It exists purely for the routes that fall outside the `[locale]`
 * segment entirely (a request Next can't match to any locale at all), where
 * `not-found.tsx` supplies its own standalone `<html>`/`<body>` instead.
 * Without this file, Next has no root layout to hang that case off at all,
 * and throws "not-found.tsx doesn't have a root layout" — which, before this
 * file existed, corrupted the entire dev server on the first unmatched
 * request and (confirmed live) silently fell through to Next's bare,
 * unbranded default 404 in production instead of the branded one.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
