"use client";

import { useState } from "react";
import { Card, Input, Button } from "@/components/ui";
import { roiMailto } from "@/lib/institutionPull";

/**
 * A business case an institution's own team computes from its own numbers —
 * not an invented industry benchmark. Ends with mailto so they email Zakai
 * with their math (pull), not a cold sales script.
 */
export function InstitutionRoiCalculator() {
  const [volume, setVolume] = useState("200");
  const [minutes, setMinutes] = useState("12");
  const [hourlyCost, setHourlyCost] = useState("120");

  const v = Math.max(0, Number(volume) || 0);
  const m = Math.max(0, Number(minutes) || 0);
  const c = Math.max(0, Number(hourlyCost) || 0);

  const hoursSavedPerMonth = (v * m) / 60;
  const costSavedPerMonth = hoursSavedPerMonth * c;
  const costSavedPerYear = costSavedPerMonth * 12;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  const mailto = roiMailto({
    volume: v,
    minutes: m,
    hourlyCost: c,
    hoursPerMonth: hoursSavedPerMonth,
    costPerYear: costSavedPerYear,
  });

  return (
    <Card className="p-6">
      <p className="text-[13.5px] leading-relaxed text-ink-soft mb-4">
        Three numbers your own ops team already knows. This computes only the
        time your staff spends confirming that a submitted authorization is
        real and current — the specific step a signed, offline-verifiable
        Mandate replaces with a JWT check. It says nothing about the rest of
        how you handle a case, because Mandate does not touch that either.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <label className="text-[13px] font-bold text-ink-soft">
          Requests needing authority verification / month
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            className="mt-1.5"
          />
        </label>
        <label className="text-[13px] font-bold text-ink-soft">
          Minutes per manual verification, today
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="mt-1.5"
          />
        </label>
        <label className="text-[13px] font-bold text-ink-soft">
          Fully loaded staff cost / hour
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={hourlyCost}
            onChange={(e) => setHourlyCost(e.target.value)}
            className="mt-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label="Staff hours / month" value={fmt(hoursSavedPerMonth)} />
        <Stat label="Cost / month" value={fmt(costSavedPerMonth)} />
        <Stat label="Cost / year" value={fmt(costSavedPerYear)} />
      </div>

      <p className="text-[12px] leading-relaxed text-ink-soft mt-4 mb-4">
        Formula, in full: (requests × minutes ÷ 60) × hourly cost. No number
        above comes from us — change any input and the result changes with
        it. What this leaves out on purpose: reduced dispute/compliance
        exposure from a cryptographically bounded credential instead of a
        scanned document, and any change in resolution speed — both real, but
        neither is a number we&apos;d compute for you without your own data.
      </p>

      <a href={mailto} className="no-underline inline-block">
        <Button className="w-full sm:w-auto">Email these numbers to Zakai →</Button>
      </a>
      <p className="text-[11px] text-ink-soft mt-2 mb-0">
        Opens your mail client with the calculator inputs — you initiate contact.
      </p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[rgba(63,203,155,0.3)] bg-[rgba(63,203,155,0.08)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-ink-soft font-bold mb-1">{label}</div>
      <div className="text-[22px] font-display text-emerald">{value}</div>
    </div>
  );
}
