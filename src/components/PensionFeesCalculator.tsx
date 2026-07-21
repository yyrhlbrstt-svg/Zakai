"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, Input, Button } from "@/components/ui";
import { ShareResult } from "@/components/ShareResult";
import { computePensionFees } from "@/lib/pensionFees";
import { bcp47, type Locale } from "@/i18n/config";

/**
 * Pension management-fee calculator. Client-side and stateless — projects the
 * cost of the fee gap to retirement. All numbers stay in the browser.
 */
export function PensionFeesCalculator() {
  const t = useTranslations("pensionFees");
  const locale = useLocale();
  const loc = bcp47[locale as Locale];

  const [balance, setBalance] = useState("200000");
  const [monthly, setMonthly] = useState("2000");
  const [years, setYears] = useState("30");
  const [curDeposit, setCurDeposit] = useState("2");
  const [curBalance, setCurBalance] = useState("0.3");
  const [result, setResult] = useState<ReturnType<typeof computePensionFees> | null>(null);

  const money = (n: number) => `₪${Math.round(n).toLocaleString(loc)}`;

  function calc() {
    setResult(
      computePensionFees({
        balanceShekels: Number(balance) || 0,
        monthlyDepositShekels: Number(monthly) || 0,
        years: Number(years) || 0,
        currentDepositFeePct: Number(curDeposit) || 0,
        currentBalanceFeePct: Number(curBalance) || 0,
        // Achievable competitive fees — the negotiation target.
        targetDepositFeePct: 1,
        targetBalanceFeePct: 0.1,
      }),
    );
  }

  const field = (label: string, hint: string, value: string, set: (v: string) => void, suffix?: string) => (
    <label className="block">
      <span className="text-[13px] text-ink-soft block mb-1.5">{label}</span>
      <div className="relative">
        <Input type="number" value={value} onChange={(e) => set(e.target.value)} dir="ltr" className="text-start" />
        {suffix && (
          <span className="absolute inset-y-0 end-3 flex items-center text-ink-soft text-[13px] pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      <span className="text-[11px] text-ink-soft block mt-1">{hint}</span>
    </label>
  );

  return (
    <div>
      <Card className="p-6 flex flex-col gap-4">
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {field(t("balance"), t("balanceHint"), balance, setBalance, "₪")}
          {field(t("monthly"), t("monthlyHint"), monthly, setMonthly, "₪")}
          {field(t("years"), t("yearsHint"), years, setYears)}
          {field(t("curDeposit"), t("curDepositHint"), curDeposit, setCurDeposit, "%")}
          {field(t("curBalance"), t("curBalanceHint"), curBalance, setCurBalance, "%")}
        </div>
        <div>
          <Button onClick={calc}>{t("calc")}</Button>
        </div>
      </Card>

      {result && (
        <Card className="mt-5 p-7 relative overflow-hidden">
          <div
            className="absolute -top-[70px] -start-[50px] w-60 h-60 rounded-full"
            style={{ background: "#3FCB9B", filter: "blur(80px)", opacity: 0.22 }}
            aria-hidden
          />
          <div className="relative">
            <div className="text-[13px] text-ink-soft font-bold">{t("resultLabel", { years: result.years })}</div>
            <div className="font-display grad-text text-5xl mt-2">{money(result.savingsShekels)}</div>
            <div className="text-[12.5px] text-ink-soft mt-2 leading-relaxed max-w-[520px]">
              {t("resultSub", {
                current: money(result.currentFinalShekels),
                target: money(result.targetFinalShekels),
              })}
            </div>
            <div className="mt-5">
              <ShareResult message={t("shareMsg", { amount: money(result.savingsShekels) })} path="/pension-fees" />
            </div>
            <p className="text-[11px] text-ink-soft mt-4 mb-0 leading-relaxed border border-[rgba(240,180,92,0.28)] bg-[rgba(240,180,92,0.06)] rounded-xl px-3 py-2.5">
              {t("assumption")}
            </p>
          </div>
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
