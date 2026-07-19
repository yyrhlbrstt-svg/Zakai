"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
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

  const chip = (active: boolean) =>
    `rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
      active
        ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
        : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
    }`;

  return (
    <div>
      <Card className="p-6 flex flex-col gap-5">
        <div>
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("eligibilityQ")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("eligibilityQ")}>
            {(["full", "partial"] as const).map((e) => (
              <button key={e} type="button" role="radio" aria-checked={eligibility === e}
                onClick={() => setEligibility(e)} className={chip(eligibility === e)}>
                {t(`eligibility.${e}`)}
              </button>
            ))}
          </div>
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
