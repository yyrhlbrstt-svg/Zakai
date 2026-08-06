"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { Logo } from "@/components/Logo";
import { FooterAppVersion } from "@/components/FooterAppVersion";

/**
 * A footer link that stops being a link once you are already there.
 *
 * Offering someone a link to the page they are standing on is the single
 * most common way an app feels broken without anything actually failing:
 * they tap it, the page does not change, and the reasonable conclusion is
 * that the button is dead. Marking the current entry instead — greyed, not
 * clickable, aria-current for screen readers — answers "where am I" rather
 * than inviting a tap that cannot do anything.
 */
function FooterLink({
  href,
  pathname,
  primary = false,
  children,
}: {
  href: string;
  pathname: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  // Compare paths only: /money#zakai-money-scan from /money is a jump to a
  // section, which genuinely does something.
  const target = href.split("#")[0].split("?")[0];
  const isCurrent = pathname === target && !href.includes("#");

  if (isCurrent) {
    return (
      <span aria-current="page" className="text-ink-soft/50 cursor-default">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={
        primary
          ? "text-[#06121A] no-underline rounded-full px-3.5 py-1.5 bg-emerald hover:opacity-90"
          : "text-ink-soft no-underline hover:text-emerald transition-colors"
      }
    >
      {children}
    </Link>
  );
}

export function Footer() {
  const t = useTranslations();
  const pathname = usePathname();
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
        <FooterLink href="/money#zakai-money-scan" pathname={pathname} primary>
          {moneyLabel}
        </FooterLink>
        <FooterLink href="/cancel" pathname={pathname}>{cancelLabel}</FooterLink>
        <FooterLink href="/what-am-i-owed" pathname={pathname}>{owedLabel}</FooterLink>
        <FooterLink href="/electricity" pathname={pathname}>{elecLabel}</FooterLink>
        <span className="text-[rgba(147,166,165,0.35)]" aria-hidden>
          |
        </span>
        <FooterLink href="/business" pathname={pathname}>{bizLabel}</FooterLink>
        <FooterLink href="/partners" pathname={pathname}>{partnersLabel}</FooterLink>
        <FooterLink href="/institutions" pathname={pathname}>{instLabel}</FooterLink>
        <FooterLink href="/tools" pathname={pathname}>{t("footer.allTools")}</FooterLink>
        <FooterLink href="/network-proof" pathname={pathname}>
          {t("footer.networkProof")}
        </FooterLink>
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
