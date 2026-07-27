"use client";

import { useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { rankPriorityActions } from "@/lib/priority";
import { SpotlightCard } from "@/components/SpotlightCard";

export function PriorityActions({ limit = 5 }: { limit?: number }) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const items = rankPriorityActions(limit);

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
      {items.map((a) => (
        <Link key={a.id} href={a.href} className="no-underline text-ink">
          <SpotlightCard className="p-4 h-full hover:border-[rgba(63,203,155,0.45)] transition-colors">
            <div className="font-extrabold text-[14.5px]">{he ? a.titleHe : a.titleEn}</div>
            <div className="text-ink-soft text-[12px] mt-1">{he ? a.whyHe : a.whyEn}</div>
            <div className="text-emerald text-[12px] font-bold mt-2">
              {he ? `פוטנציאל ~₪${a.monthlyPotentialShekels}/ח׳` : `~₪${a.monthlyPotentialShekels}/mo potential`}
            </div>
          </SpotlightCard>
        </Link>
      ))}
    </div>
  );
}
