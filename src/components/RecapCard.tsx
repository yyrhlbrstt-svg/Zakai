"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import { ShareResult } from "@/components/ShareResult";

/**
 * "How much I've gotten back through Zakai, total" — a shareable recap card,
 * the same real per-user numbers as the track-record credential (loaded via
 * the lightweight /api/authority/recap, which skips the JWS signing step
 * this display doesn't need). Real stats only: says nothing when there's no
 * documented history yet, rather than showing a fabricated ₪0 as if it were
 * a real fact.
 */
export function RecapCard({ referralCode, bcp47 }: { referralCode?: string; bcp47: string }) {
  const t = useTranslations("recap");
  const [stats, setStats] = useState<{ resolvedCases: number; documentedMonthlySavingAgorot: number } | null>(
    null,
  );
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/authority/recap")
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((body: { stats: { resolvedCases: number; documentedMonthlySavingAgorot: number } } | null) => {
        if (cancelled) return;
        if (!body || body.stats.resolvedCases === 0) {
          setState("empty");
          return;
        }
        setStats(body.stats);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading" || state === "empty" || state === "error") return null;
  if (!stats) return null;

  const amountLabel = formatAgorot(stats.documentedMonthlySavingAgorot, bcp47);

  return (
    <Card className="p-6">
      <div className="font-display text-lg">{t("title")}</div>
      <p className="text-ink-soft text-[13.5px] mt-2 leading-relaxed">
        {t("subtitle", { cases: stats.resolvedCases, amount: amountLabel })}
      </p>
      <div className="mt-4">
        <ShareResult
          message={t("shareMessage", { amount: amountLabel })}
          amountLabel={amountLabel}
          kicker={t("shareKicker")}
          referralCode={referralCode}
        />
      </div>
    </Card>
  );
}
