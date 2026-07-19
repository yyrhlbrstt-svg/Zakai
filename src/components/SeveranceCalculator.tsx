"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { computeSeverance } from "@/lib/severance";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

/** Severance calculator — pure client-side, same pattern as miluim/payslip. */
export function SeveranceCalculator({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("severance");
  const [salary, setSalary] = useState(12000); // ₪/month
  const [years, setYears] = useState(3);
  const [months, setMonths] = useState(0);

  const r = useMemo(
    () => computeSeverance({ lastMonthlyAgorot: shekelsToAgorot(salary), years, months }),
    [salary, years, months],
  );
  const money = (a: number) => formatAgorot(a, bcp47);

  return (
    <div>
      <Card className="p-6 flex flex-col gap-5">
        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("salaryQ")}</span>
            <span className="font-display text-[15px]">{money(shekelsToAgorot(salary))}</span>
          </div>
          <input type="range" min={3000} max={60000} step={250} value={salary}
            onChange={(e) => setSalary(Number(e.target.value))} aria-label={t("salaryQ")} />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("yearsQ")}</span>
            <span className="font-display text-[15px]">{years}</span>
          </div>
          <input type="range" min={0} max={40} step={1} value={years}
            onChange={(e) => setYears(Number(e.target.value))} aria-label={t("yearsQ")} />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("monthsQ")}</span>
            <span className="font-display text-[15px]">{months}</span>
          </div>
          <input type="range" min={0} max={11} step={1} value={months}
            onChange={(e) => setMonths(Number(e.target.value))} aria-label={t("monthsQ")} />
        </label>
      </Card>

      <Card className="mt-5 p-6 text-center">
        <div className="text-[13px] text-ink-soft font-bold">{t("resultTitle")}</div>
        <div className="font-display grad-text text-4xl mt-1.5" aria-live="polite">
          {money(r.severanceAgorot)}
        </div>
        {!r.eligible && (
          <div className="text-[12.5px] text-amber mt-2">{t("notEligible")}</div>
        )}
      </Card>

      <Card className="mt-5 p-6">
        <div className="font-extrabold text-[15px] mb-3">{t("howTitle")}</div>
        <ul className="m-0 p-0 ps-4 list-disc flex flex-col gap-2 text-[13.5px] text-ink-soft leading-relaxed">
          {(t.raw("howSteps") as string[]).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Card>

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
