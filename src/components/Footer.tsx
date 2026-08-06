"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/Logo";
import { FooterAppVersion } from "@/components/FooterAppVersion";

export function Footer() {
  const t = useTranslations();
  const moneyLabel = t("footer.nav.money");
  const cancelLabel = t("footer.nav.cancel");
  const owedLabel = t("footer.nav.owed");
  const elecLabel = t("footer.nav.electricity");
  const instLabel = t("footer.nav.institutions");
  const partnersLabel = t("footer.nav.partners");
  const bizLabel = t("footer.nav.business");

  return (
    <footer className="max-w-[1080px] mx-auto px-5 py-10 mt-10 border-t border-[rgba(255,255,255,0.08)] flex flex-col gap-6">
      <ul className="flex flex-wrap gap-x-5 gap-y-2 list-none p-0 m-0 justify-center rounded-2xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
        {(["encrypted", "noTrackers", "deletion", "verifiablePoa"] as const).map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
            <span className="text-emerald" aria-hidden>●</span>
            {t(`footer.trustStrip.${k}`)}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-x-4 gap-y-2.5 justify-center text-[13px] font-bold">
        <Link href="/money#zakai-money-scan" className="text-[#06121A] no-underline rounded-full px-3.5 py-1.5 bg-emerald hover:opacity-90">
          {moneyLabel}
        </Link>
        <Link href="/cancel" className="text-ink-soft no-underline hover:text-emerald transition-colors">
          {cancelLabel}
        </Link>
        <Link href="/what-am-i-owed" className="text-ink-soft no-underline hover:text-emerald transition-colors">
          {owedLabel}
        </Link>
        <Link href="/electricity" className="text-ink-soft no-underline hover:text-emerald transition-colors">
          {elecLabel}
        </Link>
        <span className="text-[rgba(147,166,165,0.35)]" aria-hidden>
          |
        </span>
        <Link href="/business" className="text-ink-soft no-underline hover:text-emerald transition-colors">
          {bizLabel}
        </Link>
        <Link href="/partners" className="text-ink-soft no-underline hover:text-emerald transition-colors">
          {partnersLabel}
        </Link>
        <Link href="/institutions" className="text-ink-soft no-underline hover:text-emerald transition-colors">
          {instLabel}
        </Link>
        <Link href="/tools" className="text-ink-soft no-underline hover:text-emerald transition-colors">
          {t("footer.allTools")}
        </Link>
        <Link href="/network-proof" className="text-ink-soft no-underline hover:text-emerald transition-colors">
          {t("footer.networkProof")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <Logo height={15} />
          <span>© {new Date().getFullYear()}</span>
          <FooterAppVersion />
        </span>
        <span className="flex flex-wrap gap-4">
          {(
            [
              { href: "/about", key: "footer.about" as const },
              { href: "/how-it-works", key: "footer.howItWorks" as const },
              { href: "/feedback", key: "footer.feedback" as const },
              { href: "/faq", key: "footer.faq" as const },
              { href: "/results", key: "footer.results" as const },
              { href: "/companies", key: "footer.companies" as const },
              { href: "/trust", key: "footer.trust" as const },
              { href: "/terms", key: "footer.terms" as const },
              { href: "/privacy", key: "footer.privacy" as const },
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

      <p className="text-[11px] text-[rgba(147,166,165,0.7)] leading-relaxed text-center max-w-[640px] mx-auto">
        {t("footer.legalLine")}
      </p>
    </footer>
  );
}
