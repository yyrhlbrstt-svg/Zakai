import "./globals.css";

/**
 * The root fallback — separate from src/app/[locale]/not-found.tsx.
 *
 * A path Next can't match against any route at all (a typo'd URL, a deleted
 * page, a stale bookmark under a valid locale prefix like /he/xyz-old-page)
 * never actually enters the [locale] segment's layout or component tree, so
 * that not-found.tsx never renders for it — confirmed live: it fell straight
 * through to Next's own bare, unbranded default page instead. This is the
 * one that actually catches that case. It has no parent layout to inherit
 * `<html>`/`<body>` from (there is no root-level layout.tsx in this app,
 * only [locale]/layout.tsx), so it supplies its own — and stays static,
 * locale-agnostic Hebrew rather than reaching for next-intl, since a route
 * that failed to match any locale segment at all has no reliable way to know
 * which language the visitor wanted.
 */
export default function RootNotFound() {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-[#070B12] text-[#EAF2F0] min-h-screen flex items-center justify-center px-5">
        <div className="max-w-[420px] text-center">
          <div className="text-[44px] mb-4" aria-hidden>
            🧭
          </div>
          <h1 className="font-display text-2xl mb-2">העמוד הזה לא קיים</h1>
          <p className="text-[14.5px] leading-relaxed mb-6 opacity-70">
            יכול להיות שהקישור ישן, או שהכתובת הוקלדה לא נכון.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="/he"
              className="grad-bg text-[#06121A] font-extrabold rounded-2xl px-6 py-3 text-[15px] no-underline"
            >
              לעמוד הבית
            </a>
            <a
              href="/en"
              className="border border-[rgba(255,255,255,0.15)] rounded-2xl px-6 py-3 text-[15px] no-underline text-inherit"
            >
              English
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
