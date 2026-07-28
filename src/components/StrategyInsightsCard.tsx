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
  const data = await getStrategyInsights("IL");

  if (data.totalOutcomes === 0) {
    return (
      <Card className="p-5 border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.05)] mb-5">
        <div className="font-extrabold text-[14.5px]">
          {he ? "מנוע האסטרטגיה לומד" : "Strategy engine is learning"}
        </div>
        <p className="text-[12.5px] text-ink-soft mt-1.5 leading-relaxed mb-0">
          {he
            ? "אחרי כמה תיקים מתועדים יופיע כאן מה עובד מול כל ספק — בלי ניחושים."
            : "After a few documented cases, you’ll see what works against each provider — no guessing."}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5 border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.06)] mb-5">
      <div className="font-extrabold text-[14.5px] flex items-center gap-2 flex-wrap">
        {he ? "מה הסוכן למד" : "What the agent learned"}
        <span className="text-[11px] font-bold text-ink-soft">
          · {data.totalOutcomes} {he ? "תוצאות" : "outcomes"} ·{" "}
          {(data.overallWinRate * 100).toFixed(0)}% {he ? "הצלחה" : "win rate"}
        </span>
      </div>

      {data.topStance && (
        <p className="text-[13px] mt-2 mb-0">
          <span className="text-ink-soft">{he ? "גישה מובילה:" : "Leading stance:"}</span>{" "}
          <span className="font-extrabold text-emerald">{data.topStance.label}</span>
          <span className="text-ink-soft text-[12px]">
            {" "}
            ({(data.topStance.winRate * 100).toFixed(0)}% · {data.topStance.trials}{" "}
            {he ? "תיקים" : "cases"})
          </span>
        </p>
      )}

      {data.counterparties.length > 0 && (
        <ul className="mt-3 mb-0 ps-0 list-none flex flex-col gap-1.5">
          {data.counterparties.slice(0, 5).map((c) => (
            <li
              key={`${c.counterparty}-${c.vertical}`}
              className="flex justify-between gap-3 text-[13px] flex-wrap"
            >
              <span className="font-bold">{c.counterparty}</span>
              <span className="text-ink-soft">
                {(c.winRate * 100).toFixed(0)}% · {c.trials} {he ? "תיקים" : "cases"}
                {c.bestVariantLabel ? ` · ${c.bestVariantLabel}` : ""}
                {c.avgRecoveredMinor > 0
                  ? ` · ~${formatAgorot(c.avgRecoveredMinor, bcp47)}`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-ink-soft mt-3 mb-0">
        {he
          ? "נתונים מצטברים בלבד — בלי פרטי משתמשים. הסוכן בוחר גישה לפי מה ששולם בפועל."
          : "Aggregate only — no user PII. The agent picks stance from what actually got paid."}
      </p>
    </Card>
  );
}
