"use client";

import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/routing";

export type GlobalMarketRow = {
  code: string;
  label: string;
  capabilities: readonly string[];
};

export function GlobalMarketPicker({
  markets,
  currentMarket,
}: {
  markets: GlobalMarketRow[];
  currentMarket: string;
}) {
  const locale = useLocale();
  const t = useTranslations("global");
  const returnPath = `/${locale}/global`;

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
      {markets.map((m) => {
        const active = m.code === currentMarket;
        const href = `/api/markets/select?market=${encodeURIComponent(m.code)}&return=${encodeURIComponent(returnPath)}`;
        const catalogOnly = m.capabilities.length === 1 && m.capabilities[0] === "zml_catalog";
        return (
          <li key={m.code}>
            <Card
              className={`p-4 h-full flex flex-col gap-2 border transition-colors ${
                active ? "border-emerald" : "border-[rgba(255,255,255,0.08)]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-lg font-bold text-ink">{m.label}</span>
                <span className="text-[11px] font-mono text-ink-soft">{m.code}</span>
              </div>
              <p className="text-[12px] text-ink-soft m-0 flex-1">
                {catalogOnly ? t("catalogOnly") : t("fullPack")}
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                <a
                  href={href}
                  className="text-body font-bold text-emerald no-underline hover:underline"
                >
                  {active ? t("selected") : t("useMarket")}
                </a>
                <Link
                  href="/rights"
                  className="text-body font-bold text-ink-soft no-underline hover:text-emerald"
                >
                  {t("rights")}
                </Link>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
