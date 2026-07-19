"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "zk_install_dismissed";

/**
 * "Add to home screen" prompt — the last mile to feeling like a real app.
 * On Android/Chrome we capture `beforeinstallprompt` and offer a one-tap
 * install. On iOS Safari (no such event) we show the manual Share → Add
 * instruction. Hidden when already installed, or once dismissed.
 */
export function InstallPrompt() {
  const t = useTranslations("install");
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Already installed (running standalone) or previously dismissed → never show.
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

    // iOS Safari has no beforeinstallprompt — offer manual instructions.
    const ua = window.navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIOS && isSafari) {
      timer = setTimeout(() => {
        setIosHint(true);
        setShow(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      if (timer) clearTimeout(timer);
    };
  }, []);

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

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[9998] mx-auto max-w-[520px] rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[#0c1420] shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-4 flex items-center gap-3">
      <div className="w-10 h-10 shrink-0 rounded-[11px] grad-bg text-[#06121A] flex items-center justify-center font-black text-lg">
        Z
      </div>
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
        className="shrink-0 text-ink-soft hover:text-ink text-lg leading-none px-1"
      >
        ✕
      </button>
    </div>
  );
}
