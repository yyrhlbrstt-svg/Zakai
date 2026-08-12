"use client";

import { useEffect, useState } from "react";
import { COLLECTIVE_VERTICALS } from "@/lib/collective/verticals";

type Summary = {
  market: string;
  total_signals: number;
  by_vertical: Record<string, number>;
  phase: string;
};

export function CollectiveSummaryPanel({
  market,
  title,
  sub,
  totalLabel,
  verticalLabel,
  apiHint,
}: {
  market: string;
  title: string;
  sub: string;
  totalLabel: string;
  verticalLabel: string;
  apiHint: string;
}) {
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/collective/summary?market=${encodeURIComponent(market)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("summary"))))
      .then((j: Summary) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [market]);

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] p-5 mb-6">
      <h3 className="text-[15px] font-extrabold m-0 mb-1">{title}</h3>
      <p className="text-body text-ink-soft m-0 mb-4 leading-relaxed">{sub}</p>
      {err && (
        <p className="text-body text-ink-soft m-0">{apiHint}</p>
      )}
      {data && (
        <>
          <p className="text-[22px] font-display font-extrabold text-emerald m-0 mb-3">
            {totalLabel.replace("{n}", String(data.total_signals))}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {COLLECTIVE_VERTICALS.map((v) => (
              <div
                key={v}
                className="flex justify-between gap-2 text-[12.5px] border-b border-[rgba(255,255,255,0.06)] pb-1"
              >
                <span className="text-ink-soft">{verticalLabel.replace("{id}", v)}</span>
                <span className="font-mono font-bold">{data.by_vertical[v] ?? 0}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-soft mt-4 m-0 font-mono">{apiHint}</p>
        </>
      )}
    </div>
  );
}
