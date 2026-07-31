"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, RadioChips } from "@/components/ui";
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
          <RadioChips
            value={String(points)}
            onChange={(v) => setPoints(Number(v))}
            ariaLabel={t("pointsQ")}
            options={[2.25, 2.75].map((p) => ({ value: String(p), label: t(p === 2.25 ? "pointsMan" : "pointsWoman") }))}
          />
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
        {r.refundAgorot > 0 && (
          <ShareResult message={tShare("msgTax")} path="/taxrefund" amountLabel={money(r.refundAgorot)} />
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
