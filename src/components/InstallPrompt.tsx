"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { LogoMark } from "@/components/Logo";
import { FLOATING_BANNER_ATTR, useFloatingClearance } from "@/components/useFloatingClearance";
import { NON_CONSUMER_ROUTES } from "@/lib/nonConsumerRoutes";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "zk_install_dismissed";

export function InstallPrompt() {
  const t = useTranslations("install");
  const pathname = usePathname();
  const moneyOs = pathname === "/money" || pathname === "/dashboard";
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [show, setShow] = useState(false);
  const retreat = useCallback(() => setShow(false), []);
  const { ref, clear } = useFloatingClearance(show, retreat);

  useEffect(() => {
    setShow(false);
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
  if (NON_CONSUMER_ROUTES.some((r) => pathname.startsWith(r))) return null;
  if (!show) return null;

  return (
    <div
      ref={ref}
      {...{ [FLOATING_BANNER_ATTR]: "install" }}
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
        className="shrink-0 text-ink-soft hover:text-ink text-lg leading-none grid place-items-center min-w-[28px] min-h-[28px] bg-transparent border-0 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
