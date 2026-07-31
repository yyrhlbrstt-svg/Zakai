"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Input } from "@/components/ui";
import { OutcomeReport } from "@/components/OutcomeReport";
import {
  computeOvertimeBackPay,
  buildOvertimeDemandLetter,
  LOOKBACK_YEARS_MAX,
} from "@/lib/overtimeBackPay";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

/**
 * Overtime back-pay calculator + letter. Pure client-side, like every other
 * calculator in this app — nothing typed here leaves the browser until the
 * person chooses to copy the letter and send it themselves.
 */
export function OvertimeBackPayCalculator({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("overtimeBackPay");
  const [hourlyWage, setHourlyWage] = useState(45);
  const [dailyHours, setDailyHours] = useState(2);
  const [daysPerMonth, setDaysPerMonth] = useState(20);
  const [monthsWorked, setMonthsWorked] = useState(12);
  const [employeeName, setEmployeeName] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [letter, setLetter] = useState("");
  const [copied, setCopied] = useState(false);

  const result = useMemo(
    () =>
      computeOvertimeBackPay({
        hourlyWageAgorot: shekelsToAgorot(hourlyWage),
        dailyOvertimeHours: dailyHours,
        daysPerMonth,
        monthsWorked,
      }),
    [hourlyWage, dailyHours, daysPerMonth, monthsWorked],
  );
  const money = (a: number) => formatAgorot(a, bcp47);

  function generateLetter() {
    setLetter(
      buildOvertimeDemandLetter({
        employeeName: employeeName.trim() || t("defaultName"),
        employerName: employerName.trim() || t("defaultEmployer"),
        monthsWorked,
        result,
      }),
    );
  }

  return (
    <div>
      <Card className="p-6 flex flex-col gap-5">
        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("wageQ")}</span>
            <span className="font-display text-[15px]">{money(shekelsToAgorot(hourlyWage))}</span>
          </div>
          <input
            type="range"
            min={35}
            max={200}
            step={1}
            value={hourlyWage}
            onChange={(e) => setHourlyWage(Number(e.target.value))}
            aria-label={t("wageQ")}
          />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("dailyHoursQ")}</span>
            <span className="font-display text-[15px]">{dailyHours}</span>
          </div>
          <input
            type="range"
            min={0}
            max={6}
            step={0.5}
            value={dailyHours}
            onChange={(e) => setDailyHours(Number(e.target.value))}
            aria-label={t("dailyHoursQ")}
          />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("daysPerMonthQ")}</span>
            <span className="font-display text-[15px]">{daysPerMonth}</span>
          </div>
          <input
            type="range"
            min={1}
            max={26}
            step={1}
            value={daysPerMonth}
            onChange={(e) => setDaysPerMonth(Number(e.target.value))}
            aria-label={t("daysPerMonthQ")}
          />
        </label>

        <label className="block">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-[13px] text-ink-soft">{t("monthsWorkedQ")}</span>
            <span className="font-display text-[15px]">{monthsWorked}</span>
          </div>
          <input
            type="range"
            min={1}
            max={LOOKBACK_YEARS_MAX * 12 + 24}
            step={1}
            value={monthsWorked}
            onChange={(e) => setMonthsWorked(Number(e.target.value))}
            aria-label={t("monthsWorkedQ")}
          />
        </label>
      </Card>

      <Card className="mt-5 p-6 text-center">
        <div className="text-[13px] text-ink-soft font-bold">{t("resultTitle")}</div>
        <div className="font-display grad-text text-4xl mt-1.5" aria-live="polite">
          {money(result.totalAgorot)}
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2.5 text-[12px] text-ink-soft">
          <span>{t("monthly")}: <b className="text-ink">{money(result.monthlyPayAgorot)}</b></span>
          <span>{t("monthsCounted", { count: result.monthsCounted })}</span>
        </div>
        {result.capped && (
          <p className="text-[12px] text-ink-soft mt-3 leading-relaxed">{t("cappedNote")}</p>
        )}
      </Card>

      <Card className="mt-5 p-6 flex flex-col gap-3">
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("nameQ")}</span>
            <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-[13px] text-ink-soft block mb-1.5">{t("employerQ")}</span>
            <Input value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
          </label>
        </div>
        <Button onClick={generateLetter}>{t("generateCta")}</Button>
      </Card>

      {letter && (
        <Card className="mt-5 p-6">
          <textarea
            readOnly
            value={letter}
            rows={16}
            dir="rtl"
            className="w-full px-4 py-3 rounded-xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.05)] text-[13px] leading-relaxed text-ink outline-none box-border"
          />
          <div className="flex gap-3 mt-3 flex-wrap items-center">
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(letter);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* selectable */
                }
              }}
            >
              {copied ? t("copied") : t("copy")}
            </Button>
            <span className="text-[12px] text-ink-soft">{t("sendHint")}</span>
          </div>
          <OutcomeReport vertical="overtime_backpay" counterparty="employer" variantId="standard" />
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
