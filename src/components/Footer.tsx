"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function Footer() {
  const t = useTranslations();
  return (
    <footer className="max-w-[1080px] mx-auto px-5 py-8 mt-8 border-t border-[rgba(255,255,255,0.07)] flex flex-wrap items-center justify-between gap-3">
      <span className="text-[12.5px] text-ink-soft">
        © {new Date().getFullYear()} {t("brand")}
      </span>
      <Link
        href="/trust"
        className="text-[13px] font-bold text-ink-soft hover:text-emerald no-underline transition-colors duration-200"
      >
        {t("footer.trust")}
      </Link>
    </footer>
  );
}
