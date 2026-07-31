import { getTranslations } from "next-intl/server";
import { getStrategyInsights } from "@/lib/strategy/insights";
import { Card } from "@/components/ui";
import { formatAgorot } from "@/lib/money";

/**
 * Founder-grade transparency: show the Strategy Engine's learned evidence
 * on the dashboard. Empty state is honest when the dataset is still thin.
 */
export async function StrategyInsightsCard({
  locale,
  bcp47,
}: {
  locale: string;
  bcp47: string;
}) {
  const he = locale === "he" || locale === "ar";
  const tIcomponents_StrategyInsightsCard = await getTranslations({ locale, namespace: "inline_components_StrategyInsightsCard" });
  const data = await getStrategyInsights("IL");

  if (data.totalOutcomes === 0) {
    return (
      <Card className="p-5 border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.05)] mb-5">
        <div className="font-extrabold text-[14.5px]">
          {tIcomponents_StrategyInsightsCard("t_8c06d53e")}
        </div>
        <p className="text-[12.5px] text-ink-soft mt-1.5 leading-relaxed mb-0">
          {tIcomponents_StrategyInsightsCard("t_9c42494d")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.06)] mb-5">
      <div className="font-extrabold text-[14.5px] flex items-center gap-2 flex-wrap">
        {tIcomponents_StrategyInsightsCard("t_f77b8e7d")}
        <span className="text-[11px] font-bold text-ink-soft">
          · {data.totalOutcomes} {tIcomponents_StrategyInsightsCard("t_bfb0a294")} ·{" "}
          {(data.overallWinRate * 100).toFixed(0)}% {tIcomponents_StrategyInsightsCard("t_47e46d89")}
        </span>
      </div>

      {data.topStance && (
        <p className="text-[13px] mt-2 mb-0">
          <span className="text-ink-soft">{tIcomponents_StrategyInsightsCard("t_eddcfda5")}</span>{" "}
          <span className="font-extrabold text-emerald">
            {he ? data.topStance.labelHe : data.topStance.labelEn}
          </span>
          <span className="text-ink-soft text-[12px]">
            {" "}
            ({(data.topStance.winRate * 100).toFixed(0)}% · {data.topStance.trials}{" "}
            {tIcomponents_StrategyInsightsCard("t_ebbe65bd")})
          </span>
        </p>
      )}

      {data.counterparties.length > 0 && (
        <ul className="mt-3 mb-0 ps-0 list-none flex flex-col gap-1.5">
          {data.counterparties.slice(0, 5).map((c) => {
            const bestVariantLabel = he ? c.bestVariantLabelHe : c.bestVariantLabelEn;
            return (
              <li
                key={`${c.counterparty}-${c.vertical}`}
                className="flex justify-between gap-3 text-[13px] flex-wrap"
              >
                <span className="font-bold">{c.counterparty}</span>
                <span className="text-ink-soft">
                  {(c.winRate * 100).toFixed(0)}% · {c.trials} {tIcomponents_StrategyInsightsCard("t_ebbe65bd")}
                  {bestVariantLabel ? ` · ${bestVariantLabel}` : ""}
                  {c.avgRecoveredMinor > 0
                    ? ` · ~${formatAgorot(c.avgRecoveredMinor, bcp47)}`
                    : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-ink-soft mt-3 mb-0">
        {tIcomponents_StrategyInsightsCard("t_8b5199e5")}
      </p>
    </Card>
  );
}
