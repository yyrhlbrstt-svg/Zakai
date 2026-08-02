"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LogoMark } from "@/components/Logo";

const DISMISS_KEY = "zk_install_money_inline";

/** Inline “add to home screen” on Money OS — complements the global InstallPrompt. */
export function MoneyInstallInline() {
  const locale = useLocale();
  const t = useTranslations("install");
  const he = locale === "he" || locale === "ar";
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="rounded-xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.08)] px-4 py-3.5 flex items-start gap-3 mb-6">
      <LogoMark size={36} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-[13.5px]">{t("moneyTitle")}</div>
        <p className="text-[12px] text-ink-soft mt-1 leading-relaxed">{he ? t("moneyHintHe") : t("moneyHintEn")}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          setShow(false);
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* ignore */
          }
        }}
        className="shrink-0 text-ink-soft hover:text-ink text-lg bg-transparent border-0 cursor-pointer"
        aria-label={t("dismiss")}
      >
        ✕
      </button>
    </div>
  );
}
