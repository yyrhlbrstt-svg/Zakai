"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { LogoMark } from "@/components/Logo";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "zk_install_dismissed";

/** Everything a person can press, type in or drag. */
const INTERACTIVE =
  'button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="radio"],[role="checkbox"]';

/**
 * Is this banner sitting on top of something the person needs?
 *
 * Asked geometrically rather than guessed from the route, because guessing is
 * what failed. First there was a hand-written list of five paths where a
 * bottom-fixed banner was known to hurt, out of well over a hundred routes —
 * so on the flight claim it sat on the route field, the airline's email
 * address and the button that opens the claim. Then there was a rule about
 * which kinds of field a page contains, which was better and still wrong: it
 * let the banner through on /pricing, where it covered "choose plan".
 *
 * A rectangle either overlaps another rectangle or it does not. There is no
 * version of this question that needs an opinion about which pages matter.
 */
function overlapsSomethingUsable(banner: HTMLElement): boolean {
  const b = banner.getBoundingClientRect();
  for (const el of document.querySelectorAll<HTMLElement>(INTERACTIVE)) {
    if (banner.contains(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
      continue;
    }
    if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) return true;
  }
  return false;
}

export function InstallPrompt() {
  const t = useTranslations("install");
  const pathname = usePathname();
  const moneyOs = pathname === "/money" || pathname === "/dashboard";
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);
  /**
   * Rendered but not yet painted. The overlap test needs a real rectangle, and
   * a rectangle needs a render — so the banner mounts invisible, gets measured,
   * and only then appears. Without this it would flash into view over the
   * button it is about to get out of the way of.
   */
  const [clear, setClear] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShow(false);
    setClear(false);
  }, [pathname]);

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
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIOS && isSafari) {
      timer = setTimeout(() => {
        setIosHint(true);
        setShow(true);
      }, moneyOs ? 900 : 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      if (timer) clearTimeout(timer);
    };
  }, [moneyOs]);

  const retreat = useCallback(() => {
    setShow(false);
    setClear(false);
  }, []);

  /**
   * Once shown, keep checking — the page moves under a fixed element, so what
   * is beneath it changes with every scroll and every card that expands.
   *
   * Retreating is one-way for this page view. A banner that reappeared as soon
   * as the obstruction scrolled past would blink in and out down the length of
   * the page, which is its own kind of unusable. `setShow(false)` and not
   * `dismiss()`: they did not decline the app, they went back to what they were
   * doing, so the offer can return on a later visit.
   */
  useEffect(() => {
    if (!show) return;
    const el = ref.current;
    if (!el) return;

    const check = () => {
      if (overlapsSomethingUsable(el)) retreat();
      else setClear(true);
    };
    check();

    let queued = 0;
    const onMove = () => {
      window.clearTimeout(queued);
      queued = window.setTimeout(check, 120);
    };
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    const onFocusIn = () => retreat();
    document.addEventListener("focusin", onFocusIn);
    // Cards that expand, results that render — anything that puts a new control
    // under the banner without a scroll or a resize to announce it.
    const observer = new MutationObserver(onMove);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(queued);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("focusin", onFocusIn);
      observer.disconnect();
    };
  }, [show, retreat]);

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
    <div
      ref={ref}
      aria-hidden={!clear}
      className="fixed inset-x-3 bottom-3 z-[9998] mx-auto max-w-[520px] rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[#0c1420] shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-4 flex items-center gap-3"
      style={clear ? undefined : { visibility: "hidden", pointerEvents: "none" }}
    >
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
          className="shrink-0 grad-bg btn-sheen text-[#06121A] font-extrabold text-body rounded-xl px-4 py-2.5"
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
