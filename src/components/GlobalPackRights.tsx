"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { evaluatePack } from "@/lib/global/engine";
import type { Market } from "@/lib/global/registry";
import type { UniversalProfile } from "@/lib/global/types";
import { GlobalPackClaimDocument } from "@/components/GlobalPackClaimDocument";

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
 * The results list for a `JurisdictionPack` market — all non-IL MARKETS in registry.
 *
 * These packs carry a real statutory citation and a real letter template for
 * every right (that is the entire point of `src/lib/global/` over the older,
 * checklist-only per-country catalog in `rights.ts`), but no locale file has
 * translated title/description copy for a French or German right's specific
 * id yet — that is a real, separate translation task, sized honestly rather
 * than rushed here. Until it exists, the right's own statutory `source` (in
 * the pack's own `docLocale`, so a French right cites French law in French)
 * stands in as the label. That is not filler text: it is the actual legal
 * basis, in the language a French reader expects it in, which is more
 * trustworthy than an invented English title would be anyway.
 */
export function GlobalPackRights({ market, profile }: { market: Market; profile: UniversalProfile }) {
  const t = useTranslations("rights");
  const locale = market.pack.docLocale;
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
                {m.right.source}
              </span>
              <span className="text-[11.5px] font-extrabold text-emerald bg-[rgba(63,203,155,0.1)] border border-[rgba(63,203,155,0.3)] rounded-full px-2.5 py-1 shrink-0">
                {m.right.yearlyMinor
                  ? formatMinor(m.right.yearlyMinor, market.pack.currency, market.pack.minorUnits, locale)
                  : m.right.oneTimeMinor
                    ? formatMinor(m.right.oneTimeMinor, market.pack.currency, market.pack.minorUnits, locale)
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
