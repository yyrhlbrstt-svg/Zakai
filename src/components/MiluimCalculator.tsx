"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { computeMiluim, type MiluimEmployment } from "@/lib/miluim";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

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
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("employmentQ")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("employmentQ")}>
            {(["employee", "self_employed"] as const).map((e) => (
              <button key={e} type="button" role="radio" aria-checked={employment === e}
                onClick={() => setEmployment(e)} className={chip(employment === e)}>
                {t(`employment.${e}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">
              {employment === "employee" ? t("salaryQ") : t("incomeQ")}
            </span>
            <span className="font-display text-[15px]">{money(shekelsToAgorot(monthly))}</span>
          </div>
          <input type="range" min={3000} max={60000} step={500} value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))} aria-label={t("salaryQ")} />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("daysQ")}</span>
            <span className="font-display text-[15px]">{days}</span>
          </div>
          <input type="range" min={1} max={120} step={1} value={days}
            onChange={(e) => setDays(Number(e.target.value))} aria-label={t("daysQ")} />
        </label>
      </Card>

      <Card className="mt-5 p-6 text-center">
        <div className="text-[13px] text-ink-soft font-bold">{t("resultTitle")}</div>
        <div className="font-display grad-text text-4xl mt-1.5" aria-live="polite">
          {money(r.totalAgorot)}
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2.5 text-[12px] text-ink-soft">
          <span>{t("daily")}: <b className="text-ink">{money(r.dailyAgorot)}</b></span>
          <span>{t("base")}: <b className="text-ink">{money(r.baseAgorot)}</b></span>
          <span className="text-emerald font-bold">{t("supplement")}: {money(r.supplementAgorot)}</span>
        </div>
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
