"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, RadioChips } from "@/components/ui";
import { computeMiluim, type MiluimEmployment } from "@/lib/miluim";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";
import { NextStep } from "@/components/NextStep";

/**
 * Reserve-duty pay calculator — pure client-side (nothing leaves the
 * browser), same pattern as the electricity and flights checkers.
 */
export function MiluimCalculator({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("miluim");
  const [employment, setEmployment] = useState<MiluimEmployment>("employee");
  const [monthly, setMonthly] = useState(12000); // ₪/month (we ×3 for the basis)
  const [days, setDays] = useState(14);

  const r = useMemo(
    () =>
      computeMiluim({
        employment,
        threeMonthAgorot: shekelsToAgorot(monthly) * 3,
        serviceDays: days,
      }),
    [employment, monthly, days],
  );
  const money = (a: number) => formatAgorot(a, bcp47);

  return (
    <div>
      <Card className="p-6 flex flex-col gap-5">
        <div>
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("employmentQ")}</span>
          <RadioChips
            value={employment}
            onChange={setEmployment}
            ariaLabel={t("employmentQ")}
            options={(["employee", "self_employed"] as const).map((e) => ({ value: e, label: t(`employment.${e}`) }))}
          />
        </div>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-body text-ink-soft">
              {employment === "employee" ? t("salaryQ") : t("incomeQ")}
            </span>
            <span className="font-display text-[15px]">{money(shekelsToAgorot(monthly))}</span>
          </div>
          <input type="range" min={3000} max={60000} step={500} value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))} aria-label={t("salaryQ")} />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-body text-ink-soft">{t("daysQ")}</span>
            <span className="font-display text-[15px]">{days}</span>
          </div>
          <input type="range" min={1} max={120} step={1} value={days}
            onChange={(e) => setDays(Number(e.target.value))} aria-label={t("daysQ")} />
        </label>
      </Card>

      <Card className="mt-5 p-6 text-center">
        <div className="text-body text-ink-soft font-bold">{t("resultTitle")}</div>
        <div className="font-display grad-text text-4xl mt-1.5" aria-live="polite">
          {money(r.totalAgorot)}
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2.5 text-[12px] text-ink-soft">
          <span>{t("daily")}: <b className="text-ink">{money(r.dailyAgorot)}</b></span>
          <span>{t("base")}: <b className="text-ink">{money(r.baseAgorot)}</b></span>
          <span className="text-emerald font-bold">{t("supplement")}: {money(r.supplementAgorot)}</span>
        </div>
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
