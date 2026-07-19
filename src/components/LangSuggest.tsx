"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";

const DISMISS_KEY = "zk_lang_suggest";

/**
 * The international wedge's front door: a Hebrew-default visitor whose browser
 * is set to another language (a new immigrant, a tourist) is quietly offered
 * the English site. Shown once, dismissible, never nags. No effect for Hebrew
 * browsers or anyone already on /en.
 */
export function LangSuggest() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (locale !== "he") return; // only nudge from the Hebrew default
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }
    const langs = [navigator.language, ...(navigator.languages || [])].filter(Boolean);
    const anyHebrew = langs.some((l) => /^he|^iw/i.test(l));
    const anyEnglish = langs.some((l) => /^en/i.test(l));
    if (!anyHebrew && anyEnglish) setShow(true);
  }, [locale]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
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
          className="shrink-0 text-ink-soft hover:text-ink text-base leading-none px-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
