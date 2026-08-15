"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { estimateUnemployment } from "@/lib/unemployment";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";
import { NextStep } from "@/components/NextStep";

/** Unemployment-benefit estimator — pure client-side; returns an honest range. */
export function UnemploymentCalculator({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("unemployment");
  const [monthly, setMonthly] = useState(10000); // ₪/month
  const [age, setAge] = useState(35);

  const r = useMemo(
    () => estimateUnemployment({ monthlyAgorot: shekelsToAgorot(monthly), age }),
    [monthly, age],
  );
  const money = (a: number) => formatAgorot(a, bcp47);
  const range = (lo: number, hi: number) => `${money(lo)} – ${money(hi)}`;

  return (
    <div>
      <Card className="p-6 flex flex-col gap-5">
        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-body text-ink-soft">{t("salaryQ")}</span>
            <span className="font-display text-[15px]">{money(shekelsToAgorot(monthly))}</span>
          </div>
          <input type="range" min={3000} max={40000} step={250} value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))} aria-label={t("salaryQ")} />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-body text-ink-soft">{t("ageQ")}</span>
            <span className="font-display text-[15px]">{age}</span>
          </div>
          <input type="range" min={18} max={67} step={1} value={age}
            onChange={(e) => setAge(Number(e.target.value))} aria-label={t("ageQ")} />
        </label>
      </Card>

      <Card className="mt-5 p-6 text-center">
        <div className="text-body text-ink-soft font-bold">{t("dailyTitle")}</div>
        <div className="font-display grad-text text-[30px] mt-1.5" aria-live="polite">
          {range(r.dailyLowAgorot, r.dailyHighAgorot)}
        </div>
        <div className="text-[12px] text-ink-soft mt-1">{t("perDay")}</div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-[12.5px] text-ink-soft">
          <span>{t("days")}: <b className="text-ink">{r.days}</b></span>
          <span>{t("estTotal")}: <b className="text-ink">{range(r.totalLowAgorot, r.totalHighAgorot)}</b></span>
        </div>
        {r.capped && <div className="text-[12px] text-amber mt-2">{t("capped")}</div>}
      </Card>

      {/* This was the least prominent thing on the page: five bullets of
          13.5px grey under the number, naming the actual forms — בל/501,
          בל/502, the 3010 certificate — that get somebody paid. Whoever wrote
          them knew exactly what happens next. The reader, looking at a big
          green figure with small grey text beneath it, did not. */}
      <NextStep title={t("howTitle")} steps={t.raw("howSteps") as string[]} />

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
