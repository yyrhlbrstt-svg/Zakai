"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui";

const VERTICALS = [
  { id: "telecom", he: "סלולר / אינטרנט", en: "Mobile / internet" },
  { id: "car_insurance", he: "ביטוח רכב", en: "Car insurance" },
  { id: "energy", he: "אנרגיה", en: "Energy" },
  { id: "bank_fees", he: "עמלות בנק", en: "Bank fees" },
  { id: "subscription", he: "מנויים", en: "Subscriptions" },
  { id: "flight_compensation", he: "פיצוי טיסה", en: "Flight compensation" },
] as const;

export function CollectiveIntentForm({ market }: { market: string }) {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const [vertical, setVertical] = useState<string>("telecom");
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  async function submit() {
    setStatus("idle");
    const res = await fetch("/api/collective/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ market: market.toUpperCase(), vertical }),
    });
    setStatus(res.ok ? "ok" : "err");
  }

  return (
    <div className="flex flex-col gap-3 max-w-md">
      <label className="text-[13px] font-bold text-ink-soft">
        {he ? "אני מעוניין/ת בכוח קנייה קבוצתי ב:" : "I want group buying power for:"}
      </label>
      <select
        className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.2)] px-3 py-2 text-[14px]"
        value={vertical}
        onChange={(e) => setVertical(e.target.value)}
      >
        {VERTICALS.map((v) => (
          <option key={v.id} value={v.id}>
            {he ? v.he : v.en}
          </option>
        ))}
      </select>
      <Button type="button" onClick={submit}>
        {he ? "סמן כוונה (אנונימי)" : "Signal intent (anonymous)"}
      </Button>
      {status === "ok" && (
        <p className="text-[12px] text-emerald m-0">
          {he ? "נרשם. אין מכרז עדיין — רק ספירה ציבורית." : "Recorded. No auction yet — public count only."}
        </p>
      )}
      {status === "err" && (
        <p className="text-[12px] text-red-400 m-0">{he ? "לא הצליח — נסו שוב." : "Failed — try again."}</p>
      )}
    </div>
  );
}
