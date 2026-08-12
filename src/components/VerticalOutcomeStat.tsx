import { useTranslations } from "next-intl";
import { formatAgorot } from "@/lib/money";
import type { VerticalOutcomeStat as Stat } from "@/lib/strategy/insights";

/**
 * The number a generic price-comparison page cannot show: not "people who
 * tried this saved money" in the abstract, but how many people who generated
 * exactly this letter, for exactly this counterparty, reported back — and
 * what happened. Every trial came through OutcomeReport on a real letter, so
 * this is never hypothetical, and it is gated at the same sample size as the
 * dashboard summary for the same reason: a sample of two is noise wearing a
 * percentage sign.
 */
export function VerticalOutcomeStat({ stat, bcp47 }: { stat: Stat; bcp47: string }) {
  const t = useTranslations("outcomeStat");
  const pct = Math.round(stat.winRate * 100);

  return (
    <div className="rounded-xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.06)] px-4 py-3 text-body font-bold text-emerald mb-4">
      {stat.avgRecoveredMinor > 0
        ? t("banner", { trials: stat.trials, pct, amount: formatAgorot(stat.avgRecoveredMinor, bcp47) })
        : t("bannerNoAmount", { trials: stat.trials, pct })}
    </div>
  );
}
