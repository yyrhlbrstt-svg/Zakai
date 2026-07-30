"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, RadioChips } from "@/components/ui";
import { computeMaternity, type MaternityEligibility } from "@/lib/maternity";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

/** Maternity-allowance calculator — pure client-side. */
export function MaternityCalculator({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("maternity");
  const [monthly, setMonthly] = useState(12000); // ₪/month
  const [eligibility, setEligibility] = useState<MaternityEligibility>("full");

  const r = useMemo(
    () => computeMaternity({ monthlyAgorot: shekelsToAgorot(monthly), eligibility }),
    [monthly, eligibility],
  );
  const money = (a: number) => formatAgorot(a, bcp47);

  return (
    <div>
      <Card className="p-6 flex flex-col gap-5">
        <div>
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("eligibilityQ")}</span>
          <RadioChips
            value={eligibility}
            onChange={setEligibility}
            ariaLabel={t("eligibilityQ")}
            options={(["full", "partial"] as const).map((e) => ({ value: e, label: t(`eligibility.${e}`) }))}
          />
        </div>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("salaryQ")}</span>
            <span className="font-display text-[15px]">{money(shekelsToAgorot(monthly))}</span>
          </div>
          <input type="range" min={3000} max={60000} step={250} value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))} aria-label={t("salaryQ")} />
        </label>
      </Card>

      <Card className="mt-5 p-6 text-center">
        <div className="text-[13px] text-ink-soft font-bold">{t("resultTitle")}</div>
        <div className="font-display grad-text text-4xl mt-1.5" aria-live="polite">
          {money(r.totalAgorot)}
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2.5 text-[12px] text-ink-soft">
          <span>{t("daily")}: <b className="text-ink">{money(r.dailyAgorot)}</b></span>
          <span>{t("days")}: <b className="text-ink">{r.days}</b></span>
        </div>
        {r.capped && <div className="text-[12px] text-amber mt-2">{t("capped")}</div>}
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
