"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { formatAgorot } from "@/lib/money";

interface WatchItemRow {
  rightId: string;
  daysLeft: number | null;
  urgency: "expired" | "critical" | "soon" | "ample" | "no_deadline";
  valueAtRiskMinor: number;
  taxYear: number | null;
}

const URGENCY_COLOR: Record<WatchItemRow["urgency"], string> = {
  expired: "#93A6A5",
  critical: "#F08A6B",
  soon: "#F0B45C",
  ample: "#3EC6FF",
  no_deadline: "#93A6A5",
};

/**
 * The visible half of the Vigil. runVigil (the daily cron) computes exactly
 * this data to decide whether to send a push — but the push linked to /score,
 * which never actually showed the countdown that triggered it. This is that
 * missing half: the same pure engine (buildWatchList/summariseWatch), read on
 * demand instead of only pushed once a fortnight.
 */
export function VigilWatchCard({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("rights");
  const tw = useTranslations("vigilWatch");
  const [state, setState] = useState<
    { loading: true } | { loading: false; hasProfile: false } | { loading: false; hasProfile: true; items: WatchItemRow[]; atRiskSoonMinor: number }
  >({ loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vigil/watch")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setState(data.hasProfile ? { loading: false, ...data } : { loading: false, hasProfile: false });
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, hasProfile: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading || !state.hasProfile) return null;

  return (
    <Card className="p-6 mt-5">
      <div className="font-display text-lg mb-1">{tw("title")}</div>
      <p className="text-ink-soft text-[13px] mb-4">{tw("sub")}</p>

      {state.items.length === 0 ? (
        <p className="text-ink-soft text-[13.5px] m-0">{tw("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {state.items.map((item) => (
            <div
              key={`${item.rightId}-${item.taxYear ?? ""}`}
              className="flex items-center gap-3 flex-wrap rounded-xl border border-[rgba(255,255,255,0.07)] px-4 py-3"
            >
              <div className="flex-1 min-w-[140px] font-bold text-[13.5px]">
                {t.has(`items.${item.rightId}.title`) ? t(`items.${item.rightId}.title`) : item.rightId}
                {item.taxYear ? ` (${item.taxYear})` : ""}
              </div>
              <div className="text-[13px] font-extrabold text-emerald">
                {formatAgorot(item.valueAtRiskMinor, bcp47)}
              </div>
              {item.daysLeft !== null && (
                <div
                  className="text-[11.5px] font-extrabold rounded-full px-2.5 py-1"
                  style={{
                    color: URGENCY_COLOR[item.urgency],
                    background: `${URGENCY_COLOR[item.urgency]}18`,
                    border: `1px solid ${URGENCY_COLOR[item.urgency]}44`,
                  }}
                >
                  {item.daysLeft < 0 ? tw("expired") : tw("daysLeft", { count: item.daysLeft })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
