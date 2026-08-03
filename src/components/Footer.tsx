"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/Logo";
import { FooterAppVersion } from "@/components/FooterAppVersion";
import { FooterSupportLink } from "@/components/FooterSupportLink";
import { mustHavePageCopy } from "@/lib/monopoly/mustHaveKit";

export function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const mustHaveLabel = mustHavePageCopy(locale).kicker;
  const moneyLabel =
    locale === "he" ? "הכסף שלי" : locale === "ar" ? "أموالي" : locale === "ru" ? "Мои деньги" : "My money";
  const cancelLabel =
    locale === "he" ? "ביטול מנוי" : locale === "ar" ? "إلغاء اشتراك" : locale === "ru" ? "Отмена подписки" : "Cancel sub";
  const owedLabel =
    locale === "he" ? "מה מגיע לי" : locale === "ar" ? "ما يحق لي" : locale === "ru" ? "Что мне должны" : "What am I owed";
  const elecLabel =
    locale === "he" ? "חשמל" : locale === "ar" ? "كهرباء" : locale === "ru" ? "Электричество" : "Electricity";
  const instLabel =
    locale === "he" ? "למוסדות · Mandate" : locale === "ar" ? "للمؤسسات" : locale === "ru" ? "Для учреждений" : "Institutions · Mandate";
  const partnersLabel =
    locale === "he" ? "שותפים · Embed" : locale === "ar" ? "شركاء" : locale === "ru" ? "Партнёры" : "Partners · Embed";
  const bizLabel =
    locale === "he" ? "B2B · עובדים + API" : locale === "ar" ? "B2B" : locale === "ru" ? "B2B" : "B2B · employees + API";

  return (
    <footer className="max-w-[1080px] mx-auto px-5 py-8 mt-8 border-t border-[rgba(255,255,255,0.07)] flex flex-col gap-5">
      <ul className="flex flex-wrap gap-x-5 gap-y-2 list-none p-0 m-0 justify-center">
        {(["encrypted", "noTrackers", "deletion", "verifiablePoa"] as const).map((k) => (
          <li key={k} className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
            <span className="text-emerald" aria-hidden>●</span>
            {t(`footer.trustStrip.${k}`)}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-[13px] font-bold">
        <Link
          href="/money#zakai-money-scan"
          className="text-[#06121A] no-underline rounded-full px-3.5 py-1.5 bg-emerald hover:opacity-90"
        >
          {moneyLabel}
        </Link>
        <Link href="/cancel" className="text-ink-soft no-underline hover:text-emerald">
          {cancelLabel}
        </Link>
        <Link href="/dashboard" className="text-ink-soft no-underline hover:text-emerald">
          {t("nav.dashboard")}
        </Link>
        <span className="text-[rgba(147,166,165,0.4)]" aria-hidden>
          |
        </span>
        <Link href="/institutions" className="text-ink-soft no-underline hover:text-emerald">
          {instLabel}
        </Link>
        <Link href="/tools" className="text-ink-soft no-underline hover:text-emerald">
          {t("footer.allTools")}
        </Link>
      </div>
      <details className="text-[12.5px] text-ink-soft text-center">
        <summary className="cursor-pointer font-bold select-none">
          {locale === "he" ? "עוד קישורים" : "More links"}
        </summary>
        <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-3 font-bold">
          <Link href="/must-have" className="text-ink-soft no-underline hover:text-emerald">
            {mustHaveLabel}
          </Link>
          <Link href="/what-am-i-owed" className="text-ink-soft no-underline hover:text-emerald">
            {owedLabel}
          </Link>
          <Link href="/electricity" className="text-ink-soft no-underline hover:text-emerald">
            {elecLabel}
          </Link>
          <Link href="/standard" className="text-ink-soft no-underline hover:text-emerald">
            {locale === "he" ? "תקן Interop" : "Interop standard"}
          </Link>
          <Link href="/global" className="text-ink-soft no-underline hover:text-emerald">
            {t("footer.global")}
          </Link>
          <Link href="/business" className="text-ink-soft no-underline hover:text-emerald">
            {bizLabel}
          </Link>
          <Link href="/partners" className="text-ink-soft no-underline hover:text-emerald">
            {partnersLabel}
          </Link>
          <Link href="/network-proof" className="text-ink-soft no-underline hover:text-emerald">
            {t("footer.networkProof")}
          </Link>
        </div>
      </details>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <Logo height={15} />
          <span>© {new Date().getFullYear()}</span>
          <FooterAppVersion />
        </span>
        <span className="flex flex-wrap gap-4 items-center">
          <FooterSupportLink />
          {(
            [
              { href: "/about", key: "footer.about" as const },
              { href: "/feedback", key: "footer.feedback" as const },
              { href: "/faq", key: "footer.faq" as const },
              { href: "/results", key: "footer.results" as const },
              { href: "/companies", key: "footer.companies" as const },
              { href: "/trust", key: "footer.trust" as const },
              { href: "/terms", key: "footer.terms" as const },
            { href: "/privacy", key: "footer.privacy" as const },
            {
              href: "https://github.com/yyrhlbrstt-svg/Zakai",
              key: "footer.github" as const,
              external: true,
            },
          ] as const
          ).map((l) =>
            "external" in l && l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] font-bold text-ink-soft hover:text-emerald no-underline transition-colors duration-200"
              >
                {t(l.key)}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href}
                className="text-[13px] font-bold text-ink-soft hover:text-emerald no-underline transition-colors duration-200"
              >
                {t(l.key)}
              </Link>
            ),
          )}
        </span>
      </div>

      <p className="text-[11px] text-[rgba(147,166,165,0.7)] leading-relaxed text-center max-w-[640px] mx-auto">
        {t("footer.legalLine")}
      </p>
    </footer>
  );
}
