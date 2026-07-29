"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";

type Band = "none" | "under_100" | "under_1k" | "under_10k" | "over_10k";

/**
 * "Did anything come back?"
 *
 * WHY IT IS HERE AND NOT IN A DASHBOARD
 *
 * The moment somebody knows the answer is the moment they open the letter's
 * reply, not the moment they log in to a summary screen. A report that lives
 * behind an account is one that gets filled in by the small fraction of people
 * who came back for another reason, which is a biased sample collected slowly.
 * So it sits directly under the letter that produced it, and needs nothing.
 *
 * WHY IT ASKS FOR A BAND AND NOT A NUMBER
 *
 * A band is enough to learn from and too blunt to identify anybody, which is
 * what lets this be accepted without authentication at all. It is also easier
 * to answer honestly: most people remember roughly what came back and would
 * have to go and look to give an exact figure, and a field that requires
 * looking something up is a field that stays empty.
 *
 * WHAT IT DOES NOT DO
 *
 * It does not thank anybody for a win or commiserate over a refusal. The two
 * answers get the same acknowledgement, because a form that visibly prefers one
 * answer is a form that gets that answer — and a dataset of nothing but
 * successes is worse than no dataset, since it reads as evidence while being
 * the opposite.
 */
export function OutcomeReport({
  market = "IL",
  vertical,
  counterparty,
  variantId,
}: {
  market?: string;
  vertical: string;
  counterparty: string;
  variantId: string;
}) {
  const t = useTranslations("outcome");
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  async function report(paid: boolean, amountBand: Band, days: number) {
    setSent(true);
    try {
      await fetch("/api/outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ market, vertical, counterparty, variantId, paid, amountBand, days }),
      });
    } catch {
      // Their report is a gift and a failure to store it is our problem. It is
      // never surfaced as something they did wrong.
    }
  }

  if (sent) {
    return <p className="text-[12.5px] text-emerald mt-3 mb-0">{t("thanks")}</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 bg-transparent border-0 p-0 cursor-pointer text-ink-soft text-[12.5px] underline"
      >
        {t("prompt")}
      </button>
    );
  }

  const band = (label: string, paid: boolean, b: Band) => (
    <Button key={b} variant="ghost" onClick={() => report(paid, b, 30)}>
      {label}
    </Button>
  );

  return (
    <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
      <p className="text-[12.5px] m-0 mb-3 leading-relaxed">{t("question")}</p>
      <div className="flex gap-2 flex-wrap">
        {/* Refusal first. Putting the win at the top of a list is a thumb on
            the scale, and the whole value of this is that it is not. */}
        {band(t("bands.none"), false, "none")}
        {band(t("bands.under_100"), true, "under_100")}
        {band(t("bands.under_1k"), true, "under_1k")}
        {band(t("bands.under_10k"), true, "under_10k")}
        {band(t("bands.over_10k"), true, "over_10k")}
      </div>
      <p className="text-[11.5px] text-ink-soft mt-3 mb-0 leading-relaxed">{t("privacy")}</p>
    </div>
  );
}
