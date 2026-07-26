"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

const CONSENT_KEY = "zk_cookie_consent";

/**
 * Honest consent surface. Zakai uses no marketing/analytics cookies, but the
 * browser still warns users on first visit. This banner tells them up front,
 * lets them dismiss the notice, and links to the trust page for proof.
 */
export function TrustBanner() {
  const t = useTranslations("trustBanner");
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setShow(true);
    } catch {
      /* ignore */
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label={t("aria")}
      className="fixed inset-x-3 bottom-3 z-[9997] mx-auto max-w-[520px] rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[#0c1420] shadow-[0_24px_60px_rgba(0,0,0,0.55)] p-4"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 shrink-0 rounded-[10px] bg-[rgba(63,203,155,0.12)] border border-[rgba(63,203,155,0.25)] text-emerald flex items-center justify-center text-lg"
          aria-hidden
        >
          🔒
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-[14px]">{t("title")}</div>
          <p className="text-ink-soft text-[12px] mt-1 leading-relaxed m-0">
            {t("body")}{" "}
            <Link href="/trust" className="text-emerald font-bold no-underline">
              {t("link")}
            </Link>
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Link
          href="/trust"
          className="px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-ink-soft hover:text-ink hover:bg-[rgba(255,255,255,0.06)] transition-colors no-underline"
        >
          {t("details")}
        </Link>
        <button
          type="button"
          onClick={accept}
          className="grad-bg btn-sheen text-[#06121A] font-extrabold text-[12.5px] rounded-xl px-4 py-2"
        >
          {t("ok")}
        </button>
      </div>
    </div>
  );
}
