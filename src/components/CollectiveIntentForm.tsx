"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui";
import { collectiveIntentCopy } from "@/lib/marketing/collectiveIntentCopy";

export function CollectiveIntentForm({ market }: { market: string }) {
  const locale = useLocale();
  const copy = collectiveIntentCopy(locale);
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
      <label className="text-[13px] font-bold text-ink-soft">{copy.label}</label>
      <select
        className="rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.2)] px-3 py-2 text-[14px]"
        value={vertical}
        onChange={(e) => setVertical(e.target.value)}
      >
        {copy.verticals.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
      <Button type="button" onClick={submit}>
        {copy.submit}
      </Button>
      {status === "ok" && <p className="text-[12px] text-emerald m-0">{copy.ok}</p>}
      {status === "err" && <p className="text-[12px] text-red-400 m-0">{copy.err}</p>}
    </div>
  );
}
