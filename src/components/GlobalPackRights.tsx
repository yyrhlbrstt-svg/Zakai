"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { evaluatePack } from "@/lib/global/engine";
import { packRightUILabel } from "@/lib/global/packLabels";
import type { Market } from "@/lib/global/registry";
import type { UniversalProfile } from "@/lib/global/types";
import { GlobalPackClaimDocument } from "@/components/GlobalPackClaimDocument";
import type { Locale } from "@/i18n/config";

function formatMinor(minor: number, currency: string, minorUnits: number, locale: string): string {
  const major = minor / minorUnits;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minor % minorUnits === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * Pack evaluation results for non-IL markets. UI titles come from
 * `packLabels` (he/en); statutory `source` is the fallback and appears in letters.
 */
export function GlobalPackRights({ market, profile }: { market: Market; profile: UniversalProfile }) {
  const t = useTranslations("rights");
  const uiLocale = useLocale() as Locale;
  const docLocale = market.pack.docLocale;
  const result = useMemo(() => evaluatePack(market.pack, profile), [market, profile]);

  if (result.matches.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-[15px] font-extrabold mb-3">
        {t("resultsTitle", { count: result.matches.length })}
      </h2>
      <Card className="py-1">
        {result.matches.map((m, i, arr) => (
          <details
            key={m.key}
            className="px-5 py-3.5"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
          >
            <summary className="cursor-pointer flex items-center gap-3 flex-wrap list-none">
              <span className="text-[13.5px] font-bold flex-1 basis-[220px] leading-snug" dir="auto">
                {packRightUILabel(market.code, m.right.id, uiLocale) ?? m.right.source}
              </span>
              <span className="text-[11.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-2.5 py-1 shrink-0">
                {m.right.yearlyMinor
                  ? formatMinor(m.right.yearlyMinor, market.pack.currency, market.pack.minorUnits, docLocale)
                  : m.right.oneTimeMinor
                    ? formatMinor(m.right.oneTimeMinor, market.pack.currency, market.pack.minorUnits, docLocale)
                    : t("valueVaries")}
              </span>
            </summary>
            <GlobalPackClaimDocument pack={market.pack} rightId={m.right.id} action={m.right.action} />
          </details>
        ))}
      </Card>
    </div>
  );
}
