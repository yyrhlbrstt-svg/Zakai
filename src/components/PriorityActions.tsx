"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  rankPriorityActions,
  formatPotentialHe,
  formatPotentialEn,
  type RankPriorityOpts,
} from "@/lib/priority";
import { SpotlightCard } from "@/components/SpotlightCard";

export function PriorityActions({
  limit = 5,
  catalogBoosts,
  pinIds,
  excludeIds,
}: {
  limit?: number;
  catalogBoosts?: Record<string, number>;
  pinIds?: RankPriorityOpts["pinIds"];
  excludeIds?: RankPriorityOpts["excludeIds"];
}) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const t = useTranslations("priority");
  const items = rankPriorityActions(limit, catalogBoosts, { pinIds, excludeIds });

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
      {items.map((a) => {
        const potential = he ? formatPotentialHe(a) : formatPotentialEn(a);
        return (
          <Link key={a.id} href={a.href} className="no-underline text-ink">
            <SpotlightCard className="p-4 h-full hover:border-[rgba(63,203,155,0.45)] transition-colors">
              <div className="font-extrabold text-[14.5px]">{he ? a.titleHe : a.titleEn}</div>
              <div className="text-ink-soft text-[12px] mt-1">{he ? a.whyHe : a.whyEn}</div>
              {/* dormant (cadence: "hidden") renders no figure at all — the
                  product's own doctrine is that a dormant-account headline is
                  a count of institutions, never a sum. */}
              {potential && (
                <div className="text-emerald text-[12px] font-bold mt-2">
                  {t("potentialLabel", { amount: potential })}
                </div>
              )}
            </SpotlightCard>
          </Link>
        );
      })}
    </div>
  );
}
