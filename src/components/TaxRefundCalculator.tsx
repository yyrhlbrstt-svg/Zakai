"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { estimatePartialYearRefund } from "@/lib/tax";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";
import { ShareResult } from "@/components/ShareResult";

/** Partial-year tax-refund estimator — pure client-side. */
export function TaxRefundCalculator({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("taxrefund");
  const tShare = useTranslations("share");
  const [monthly, setMonthly] = useState(12000); // ₪/month
  const [months, setMonths] = useState(5);
  const [points, setPoints] = useState(2.25);

  const r = useMemo(
    () =>
      estimatePartialYearRefund({
        monthlyAgorot: shekelsToAgorot(monthly),
        monthsWorked: months,
        creditPoints: points,
      }),
    [monthly, months, points],
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
        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("salaryQ")}</span>
            <span className="font-display text-[15px]">{money(shekelsToAgorot(monthly))}</span>
          </div>
          <input type="range" min={3000} max={60000} step={250} value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))} aria-label={t("salaryQ")} />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("monthsQ")}</span>
            <span className="font-display text-[15px]">{months}</span>
          </div>
          <input type="range" min={1} max={12} step={1} value={months}
            onChange={(e) => setMonths(Number(e.target.value))} aria-label={t("monthsQ")} />
        </label>

        <div>
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("pointsQ")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("pointsQ")}>
            {[2.25, 2.75].map((p) => (
              <button key={p} type="button" role="radio" aria-checked={points === p}
                onClick={() => setPoints(p)} className={chip(points === p)}>
                {t(p === 2.25 ? "pointsMan" : "pointsWoman")}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-5 p-6 text-center">
        <div className="text-[13px] text-ink-soft font-bold">{t("resultTitle")}</div>
        <div className="font-display grad-text text-4xl mt-1.5" aria-live="polite">
          {money(r.refundAgorot)}
        </div>
        {r.refundAgorot > 0 ? (
          <div className="text-[12.5px] text-ink-soft mt-2">{t("resultSub")}</div>
        ) : (
          <div className="text-[12.5px] text-ink-soft mt-2">{t("noRefund")}</div>
        )}
        {r.refundAgorot > 0 && <ShareResult message={tShare("msgTax")} path="/taxrefund" />}
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
