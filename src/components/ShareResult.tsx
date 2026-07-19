"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * The viral loop, embedded in the product. After a result, one tap shares it —
 * native share sheet where available (WhatsApp, everything), and a direct
 * WhatsApp deep link everywhere else. In Israel things spread through family
 * WhatsApp groups, so this is the zero-cost growth engine: every user who
 * finds money invites the next few.
 */
export function ShareResult({ message, path = "/entitlements" }: { message: string; path?: string }) {
  const t = useTranslations("share");
  const [copied, setCopied] = useState(false);

  function url() {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${path}`;
  }
  function fullText() {
    return `${message}\n${url()}`;
  }

  async function nativeShare() {
    const data = { title: "Zakai", text: message, url: url() };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch {
      /* user cancelled or unsupported — fall through */
    }
    copy();
  }

  function whatsapp() {
    const href = `https://wa.me/?text=${encodeURIComponent(fullText())}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] p-4 text-center">
      <div className="font-extrabold text-[14px]">{t("title")}</div>
      <div className="text-ink-soft text-[12.5px] mt-1 mb-3.5">{t("sub")}</div>
      <div className="flex gap-2.5 justify-center flex-wrap">
        <button
          type="button"
          onClick={whatsapp}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-extrabold text-[13.5px] text-[#06121A] bg-[#25D366] hover:brightness-105 transition"
        >
          <span aria-hidden>💬</span>
          {t("whatsapp")}
        </button>
        <button
          type="button"
          onClick={nativeShare}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-bold text-[13.5px] text-ink bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] hover:border-[rgba(63,203,155,0.4)] transition"
        >
          {copied ? t("copied") : t("more")}
        </button>
      </div>
    </div>
  );
}
