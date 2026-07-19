import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { MoneyScoreResult } from "@/lib/moneyScore";

/**
 * The Money Health Score card — the recurring-need moment on the dashboard.
 * A score ring with the user's number, their level, and the single highest
 * next "mission" that raises it. Server-rendered (static SVG ring).
 */
export async function MoneyScoreCard({ result }: { result: MoneyScoreResult }) {
  const t = await getTranslations("moneyScore");

  const R = 52;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - result.score / 100);
  const top = result.missions.slice(0, 2);

  return (
    <div className="rounded-2xl border border-[rgba(63,203,155,0.25)] bg-[rgba(63,203,155,0.05)] p-5 sm:p-6 mb-6">
      <div className="flex items-center gap-5 flex-wrap">
        <div className="relative w-[132px] h-[132px] shrink-0">
          <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
            <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle
              cx="66"
              cy="66"
              r={R}
              fill="none"
              stroke="url(#msGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
            />
            <defs>
              <linearGradient id="msGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3FCB9B" />
                <stop offset="0.5" stopColor="#3ec6ff" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[34px] leading-none tabular-nums grad-text">
              {result.score}
            </span>
            <span className="text-[10.5px] text-ink-soft mt-0.5">/ 100</span>
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="text-[13px] text-ink-soft font-bold">{t("title")}</div>
          <div className="font-display text-2xl mt-0.5">{t(`levels.${result.level}`)}</div>
          {top.length > 0 ? (
            <>
              <div className="text-[12px] text-ink-soft mt-3 mb-1.5 font-bold uppercase tracking-wide">
                {t("nextMission")}
              </div>
              <div className="flex flex-col gap-2">
                {top.map((m) => (
                  <Link
                    key={m.key}
                    href={m.href}
                    className="flex items-center justify-between gap-2 no-underline rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3.5 py-2.5 hover:border-[rgba(63,203,155,0.4)] transition-colors"
                  >
                    <span className="text-[13.5px] font-bold text-ink">{t(`missions.${m.key}`)}</span>
                    <span className="text-[12px] font-extrabold text-emerald shrink-0">
                      +{m.points} {t("pts")}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="text-ink-soft text-[13.5px] mt-3">{t("perfect")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
