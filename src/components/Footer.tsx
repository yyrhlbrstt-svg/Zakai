"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/Logo";

export function Footer() {
  const t = useTranslations();
  const locale = useLocale();
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
        <Link href="/money" className="text-emerald no-underline hover:underline">
          {moneyLabel}
        </Link>
        <Link href="/cancel" className="text-ink-soft no-underline hover:text-emerald">
          {cancelLabel}
        </Link>
        <Link href="/what-am-i-owed" className="text-ink-soft no-underline hover:text-emerald">
          {owedLabel}
        </Link>
        <Link href="/electricity" className="text-ink-soft no-underline hover:text-emerald">
          {elecLabel}
        </Link>
        <span className="text-[rgba(147,166,165,0.4)]" aria-hidden>
          |
        </span>
        <Link href="/business" className="text-ink-soft no-underline hover:text-emerald">
          {bizLabel}
        </Link>
        <Link href="/partners" className="text-ink-soft no-underline hover:text-emerald">
          {partnersLabel}
        </Link>
        <Link href="/institutions" className="text-ink-soft no-underline hover:text-emerald">
          {instLabel}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <Logo height={15} />
          <span>© {new Date().getFullYear()} · v1.1</span>
        </span>
        <span className="flex flex-wrap gap-4">
          {(
            [
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
