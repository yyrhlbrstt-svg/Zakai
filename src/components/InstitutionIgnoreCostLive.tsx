"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";

type IgnoreRow = {
  institutionId: string;
  dispatchedCases: number;
  savedCases: number;
  cost?: { deskHours?: number; unhandledEstimate?: number; reputationSignal?: string };
};

type IgnorePayload = {
  top?: IgnoreRow[];
  unavailable?: boolean;
  disclaimer?: string;
};

/**
 * Live ops math from disclosed Zakai dispatches — complements the manual ROI
 * calculator. Empty top[] is honest (no invented bank pressure).
 */
export function InstitutionIgnoreCostLive() {
  const t = useTranslations("institutionRoi");
  const [rows, setRows] = useState<IgnoreRow[] | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/institution/ignore-cost", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        const data = (await res.json()) as IgnorePayload;
        if (cancelled) return;
        if (data.unavailable) {
          setUnavailable(true);
          return;
        }
        setRows(Array.isArray(data.top) ? data.top : []);
        setDisclaimer(typeof data.disclaimer === "string" ? data.disclaimer : null);
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="p-6 border-[rgba(255,200,80,0.25)]">
      <h3 className="font-extrabold text-[15px] m-0 mb-2">{t("ignoreTitle")}</h3>
      <p className="text-body leading-relaxed text-ink-soft m-0 mb-3">{t("ignoreBody")}</p>

      {unavailable ? (
        <p className="text-body text-ink-soft m-0 mb-3">{t("ignoreUnavailable")}</p>
      ) : rows === null ? (
        <p className="text-body text-ink-soft m-0 mb-3">{t("ignoreLoading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-body text-ink-soft m-0 mb-3">{t("ignoreEmpty")}</p>
      ) : (
        <ul className="list-none p-0 m-0 mb-3 flex flex-col gap-2 text-body" dir="ltr">
          {rows.slice(0, 8).map((row) => (
            <li key={row.institutionId} className="flex justify-between gap-3 font-mono">
              <span>{row.institutionId}</span>
              <span>
                {t("ignoreRow", {
                  dispatched: row.dispatchedCases,
                  saved: row.savedCases,
                  hours: row.cost?.deskHours ?? 0,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11.5px] text-ink-soft m-0 mb-3 leading-relaxed">
        {disclaimer || t("ignoreDisclaimer")}
      </p>
      <a
        href="/api/institution/ignore-cost"
        className="text-emerald font-bold no-underline text-body"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("ignoreApi")} →
      </a>
    </Card>
  );
}
