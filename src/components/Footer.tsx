"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/Logo";

export function Footer() {
  const t = useTranslations();
  const locale = useLocale();
  const moneyLabel =
    locale === "he" ? "הכסף שלי" : locale === "ar" ? "أموالي" : locale === "ru" ? "Мои деньги" : "My money";
  const instLabel =
    locale === "he" ? "למוסדות" : locale === "ar" ? "للمؤسسات" : locale === "ru" ? "Для учреждений" : "Institutions";

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <Logo height={15} />
          <span>© {new Date().getFullYear()}</span>
        </span>
        <span className="flex flex-wrap gap-4">
          {(
            [
              { href: "/money", label: moneyLabel },
              { href: "/what-am-i-owed", key: "footer.whatAmIOwed" as const },
              { href: "/institutions", label: instLabel },
              { href: "/feedback", key: "footer.feedback" as const },
              { href: "/faq", key: "footer.faq" as const },
              { href: "/results", key: "footer.results" as const },
              { href: "/companies", key: "footer.companies" as const },
              { href: "/business", key: "footer.business" as const },
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
              {"label" in l ? l.label : t(l.key)}
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
