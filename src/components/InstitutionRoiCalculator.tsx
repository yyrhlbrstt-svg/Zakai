"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, Input, Button } from "@/components/ui";
import { roiMailto } from "@/lib/institutionPull";

/**
 * A business case an institution's own team computes from its own numbers —
 * not an invented industry benchmark. Ends with mailto so they email Zakai
 * with their math (pull), not a cold sales script.
 */
export function InstitutionRoiCalculator() {
  const t = useTranslations("institutionRoi");
  const locale = useLocale();
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
    n.toLocaleString(locale === "he" || locale === "ar" ? "he-IL" : "en-US", {
      maximumFractionDigits: 0,
    });

  const mailto = roiMailto({
    volume: v,
    minutes: m,
    hourlyCost: c,
    hoursPerMonth: hoursSavedPerMonth,
    costPerYear: costSavedPerYear,
  });

  return (
    <Card className="p-6">
      <p className="text-[13.5px] leading-relaxed text-ink-soft mb-4">{t("intro")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <label className="text-body font-bold text-ink-soft">
          {t("volumeLabel")}
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            className="mt-1.5"
          />
        </label>
        <label className="text-body font-bold text-ink-soft">
          {t("minutesLabel")}
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="mt-1.5"
          />
        </label>
        <label className="text-body font-bold text-ink-soft">
          {t("hourlyLabel")}
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
        <Stat label={t("hoursMonth")} value={fmt(hoursSavedPerMonth)} />
        <Stat label={t("costMonth")} value={fmt(costSavedPerMonth)} />
        <Stat label={t("costYear")} value={fmt(costSavedPerYear)} />
      </div>

      <p className="text-[12px] leading-relaxed text-ink-soft mt-4 mb-4">{t("formula")}</p>

      <a href={mailto} className="no-underline inline-block">
        <Button className="w-full sm:w-auto">{t("mailtoCta")}</Button>
      </a>
      <p className="text-[11px] text-ink-soft mt-2 mb-0">{t("mailtoHint")}</p>
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
