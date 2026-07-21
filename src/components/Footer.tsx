"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/Logo";

export function Footer() {
  const t = useTranslations();
  return (
    <footer className="max-w-[1080px] mx-auto px-5 py-8 mt-8 border-t border-[rgba(255,255,255,0.07)] flex flex-col gap-5">
      {/* Trust strip — four verifiable security facts, sitewide. Every claim
          here is enforced in code; nothing aspirational. */}
      <ul className="flex flex-wrap gap-x-5 gap-y-2 list-none p-0 m-0 justify-center">
        {(["encrypted", "noTrackers", "deletion", "verifiablePoa"] as const).map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
            <span className="text-emerald" aria-hidden>●</span>
            {t(`footer.trustStrip.${k}`)}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
        <Logo height={15} />
        <span>© {new Date().getFullYear()}</span>
      </span>
      <span className="flex flex-wrap gap-4">
        {(
          [
            { href: "/feedback", key: "footer.feedback" },
            { href: "/faq", key: "footer.faq" },
            { href: "/results", key: "footer.results" },
            { href: "/business", key: "footer.business" },
            { href: "/trust", key: "footer.trust" },
            { href: "/terms", key: "footer.terms" },
            { href: "/privacy", key: "footer.privacy" },
          ] as const
        ).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-[13px] font-bold text-ink-soft hover:text-emerald no-underline transition-colors duration-200"
          >
            {t(l.key)}
          </Link>
        ))}
      </span>
      </div>

      {/* Sitewide legal position: self-help tool, not a law firm. Keeps the
          "unauthorized practice of law" line clearly on the right side. */}
      <p className="text-[11px] text-[rgba(147,166,165,0.7)] leading-relaxed text-center max-w-[640px] mx-auto">
        {t("footer.legalLine")}
      </p>
    </footer>
  );
}
