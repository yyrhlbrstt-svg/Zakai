"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { formatAgorot } from "@/lib/money";

/**
 * Lets a user download their own signed "track record" — a portable,
 * cryptographically verifiable statement of how many cases they've resolved
 * and how much documented monthly saving they have, backed by real
 * `SavingsProof` rows (never self-reported ones). They can hand the file to
 * a new bank, landlord, or employer as evidence, and anyone can verify the
 * signature against the same public JWKS Zakai already publishes.
 *
 * Not a Mandate — it grants no authority, it only attests to the past. See
 * src/lib/mandate/trackRecordCredential.ts for why that distinction is
 * enforced at the token level, not just in this component's copy.
 */
export function TrackRecordCard({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("trackRecord");
  const [state, setState] = useState<"idle" | "loading" | "empty" | "error">("idle");
  const [stats, setStats] = useState<{ resolvedCases: number; documentedMonthlySavingAgorot: number } | null>(
    null,
  );

  async function download() {
    setState("loading");
    try {
      const res = await fetch("/api/authority/track-record");
      if (res.status === 404) {
        setState("empty");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const body = (await res.json()) as {
        credential: string;
        stats: { resolvedCases: number; documentedMonthlySavingAgorot: number };
      };
      setStats(body.stats);
      const blob = new Blob([body.credential], { type: "application/jwt" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "zakai-track-record.jwt";
      a.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <Card className="p-6">
      <div className="font-display text-lg">{t("title")}</div>
      <p className="text-ink-soft text-[13.5px] mt-2 leading-relaxed">{t("subtitle")}</p>

      <button
        type="button"
        onClick={download}
        disabled={state === "loading"}
        className="mt-4 grad-bg text-[#06121A] font-extrabold text-[13.5px] rounded-xl px-4 py-2.5 cursor-pointer border-0 disabled:opacity-60"
      >
        {state === "loading" ? t("loading") : t("cta")}
      </button>

      {state === "empty" && <p className="text-[12.5px] text-ink-soft mt-3">{t("empty")}</p>}
      {state === "error" && <p className="text-[12.5px] text-red-400 mt-3">{t("error")}</p>}
      {stats && (
        <p className="text-[12.5px] text-emerald mt-3">
          {t("downloaded", {
            cases: stats.resolvedCases,
            amount: formatAgorot(stats.documentedMonthlySavingAgorot, bcp47),
          })}
        </p>
      )}

      <p className="text-[11.5px] text-ink-soft mt-3 leading-snug">{t("note")}</p>
    </Card>
  );
}
