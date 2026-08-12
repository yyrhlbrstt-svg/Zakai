"use client";

import { useState } from "react";
import { useRouter, usePathname } from "@/i18n/routing";

/**
 * A cookie, not localStorage — because the SERVER has to know.
 *
 * The dismissal used to live in localStorage, which meant only the browser
 * could decide whether to show this, which meant it could only appear after
 * hydration, which meant it pushed `<main>` down on every page after first
 * paint. A cookie is readable in the layout, so the decision happens before
 * anything is painted and nothing moves.
 */
export const LANG_SUGGEST_COOKIE = "zk_lang_suggest";

/**
 * The international wedge's front door: a Hebrew-default visitor whose browser
 * is set to another language (a new immigrant, a tourist) is quietly offered
 * the English site. Shown once, dismissible, never nags. No effect for Hebrew
 * browsers or anyone already on /en.
 *
 * WHY `initialShow` IS A PROP AND NOT AN EFFECT
 *
 * This decided in a `useEffect`, so on the server and at first paint it
 * rendered nothing and then appeared — in the document flow, above `<main>` —
 * pushing every page down after it had already been drawn. That single
 * component was 0.0747 of layout shift on all eight pages measured, which was
 * 99% of the site's CLS. The decision needs only the Accept-Language header
 * and a cookie, both of which the server has, so it is made there and the
 * banner is in the first byte of HTML or not at all. Nothing moves either way.
 */
export function LangSuggest({ initialShow = false }: { initialShow?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(initialShow);

  function dismiss() {
    setShow(false);
    // A year, path-wide, so the server stops rendering it on the next request
    // rather than drawing it and having the client take it away again.
    document.cookie = `${LANG_SUGGEST_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
  }

  function toEnglish() {
    dismiss();
    router.replace(pathname, { locale: "en" });
  }

  if (!show) return null;

  return (
    <div className="max-w-[1080px] mx-auto px-5" dir="ltr">
      <div className="flex items-center gap-3 rounded-xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.07)] px-4 py-2.5 mb-2">
        <span className="text-[13.5px] text-ink flex-1">
          Prefer English? Zakai is available in English.
        </span>
        <button
          type="button"
          onClick={toEnglish}
          className="shrink-0 grad-bg text-[#06121A] font-extrabold text-[13px] rounded-lg px-3.5 py-1.5"
        >
          View in English
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-ink-soft hover:text-ink leading-none px-1"
        >
          {/* SVG, not "✕": that glyph is missing from many system fonts and
              renders as a tofu box (□). */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
