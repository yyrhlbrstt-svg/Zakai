"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { LogoMark } from "@/components/Logo";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "zk_install_dismissed";

/**
 * Anything a person types or chooses a value in.
 *
 * Deliberately narrower than "every form control". Radios, checkboxes and
 * buttons are one tap and appear on pages that are otherwise pure reading —
 * suppressing on those would mean the banner never showed anywhere. Sliders
 * are excluded for the same reason: the only ones on the site are the
 * illustrative calculators on the homepage and the pricing page, which are not
 * the path anybody is trying to finish. What is left is the set that marks a
 * page where somebody is entering their own details.
 */
const TEXT_ENTRY =
  'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="range"]),textarea,select';

/** True when this page currently has a field someone could be filling in. */
function pageHasTextEntry(): boolean {
  const fields = document.querySelectorAll<HTMLElement>(TEXT_ENTRY);
  for (const el of fields) {
    if (el.offsetParent !== null || el.getClientRects().length > 0) return true;
  }
  return false;
}

export function InstallPrompt() {
  const t = useTranslations("install");
  const pathname = usePathname();
  const moneyOs = pathname === "/money" || pathname === "/dashboard";
  /** Flow pages need a visible primary CTA at the bottom — defer install banner. */
  const deferInstall =
    pathname === "/cancel/universal" ||
    pathname === "/cancel" ||
    pathname === "/check" ||
    pathname === "/start" ||
    pathname === "/money";
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* ignore */
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      if (!deferInstall && !pageHasTextEntry()) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    /**
     * A form opened, or someone started typing — get out of the way.
     *
     * This banner is `position: fixed` at the bottom of the viewport, and the
     * five paths in `deferInstall` were a hand-written list of the pages where
     * that was known to hurt. The site has well over a hundred routes, so the
     * list was wrong the moment a new flow shipped: on /flights it sat directly
     * on top of the route field and the airline's email address, over the one
     * button that opens the claim. The founder's report was "I fill in the
     * ticket, it brings me here, and then it isn't clear what to do" — this was
     * a large part of why.
     *
     * A rule beats a list. Never appear over a page that already has fields in
     * it, and leave the moment focus lands in one. `setShow(false)` rather than
     * `dismiss()` on purpose: they did not decline the app, they went back to
     * their claim, so the offer can return on a later visit.
     */
    const onFocusIn = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (el?.matches?.(TEXT_ENTRY)) setShow(false);
    };
    document.addEventListener("focusin", onFocusIn);

    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!deferInstall && isIOS && isSafari) {
      timer = setTimeout(() => {
        if (pageHasTextEntry()) return;
        setIosHint(true);
        setShow(true);
      }, moneyOs ? 900 : 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      document.removeEventListener("focusin", onFocusIn);
      if (timer) clearTimeout(timer);
    };
  }, [moneyOs, deferInstall]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  }

  if (pathname === "/cancel/universal") return null;

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[9998] mx-auto max-w-[520px] rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[#0c1420] shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-4 flex items-center gap-3">
      <LogoMark size={40} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-[14px]">{t("title")}</div>
        <div className="text-ink-soft text-[12px] mt-0.5 leading-snug">
          {iosHint ? t("iosHint") : t("sub")}
        </div>
      </div>
      {!iosHint && deferred && (
        <button
          type="button"
          onClick={install}
          className="shrink-0 grad-bg btn-sheen text-[#06121A] font-extrabold text-[13px] rounded-xl px-4 py-2.5"
        >
          {t("cta")}
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="shrink-0 text-ink-soft hover:text-ink text-lg leading-none px-1 bg-transparent border-0 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
