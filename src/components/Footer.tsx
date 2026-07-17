"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Logo } from "@/components/Logo";

export function Footer() {
  const t = useTranslations();
  return (
    <footer className="max-w-[1080px] mx-auto px-5 py-8 mt-8 border-t border-[rgba(255,255,255,0.07)] flex flex-wrap items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
        <Logo height={15} />
        <span>© {new Date().getFullYear()}</span>
      </span>
      <span className="flex flex-wrap gap-4">
        {(
          [
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
    </footer>
  );
}
