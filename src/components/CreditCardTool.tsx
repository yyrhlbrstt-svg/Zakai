"use client";

import { useMemo, useState } from "react";
import { useLocale , useTranslations } from "next-intl";
import { Card, Input, Button } from "@/components/ui";
import { analyzeCreditCard } from "@/lib/creditCard";
import { Link } from "@/i18n/routing";

export function CreditCardTool() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
  const tIcomponents_CreditCardTool = useTranslations("inline_components_CreditCardTool");
  const [balance, setBalance] = useState("10000");
  const [rate, setRate] = useState("12");
  const [minPct, setMinPct] = useState("4");

  const result = useMemo(
    () =>
      analyzeCreditCard({
        balanceShekels: Number(balance) || 0,
        annualRatePct: Number(rate) || 0,
        minPayPct: Number(minPct) || 4,
      }),
    [balance, rate, minPct],
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5 flex flex-col gap-3">
        <label className="text-body text-ink-soft">
          {tIcomponents_CreditCardTool("t_540e7429")}
          <Input type="number" className="mt-1" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </label>
        <label className="text-body text-ink-soft">
          {tIcomponents_CreditCardTool("t_4bbb156f")}
          <Input type="number" className="mt-1" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className="text-body text-ink-soft">
          {tIcomponents_CreditCardTool("t_3216c28f")}
          <Input type="number" className="mt-1" value={minPct} onChange={(e) => setMinPct(e.target.value)} />
        </label>
      </Card>

      <Card className="p-6 text-center">
        <div className="text-body text-ink-soft font-bold">{tIcomponents_CreditCardTool("t_59e0bebc")}</div>
        <div className="font-display grad-text text-4xl mt-2">₪{result.monthlyInterestShekels.toLocaleString()}</div>
        <div className="text-body text-ink-soft mt-3">
          {tIcomponents_CreditCardTool("t_d51fcd64")} ₪{result.yearlyInterestShekels.toLocaleString()}
        </div>
        {result.monthsToClearIfMinOnly != null && (
          <div className="text-body text-ink-soft mt-2">
            {tIcomponents_CreditCardTool("t_bc347226")} {result.monthsToClearIfMinOnly}{" "}
            {tIcomponents_CreditCardTool("t_3acbdf22")}
          </div>
        )}
        <p className="text-[13.5px] leading-relaxed mt-4 text-ink-soft">{he ? result.tipHe : result.tipEn}</p>
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          <Link href="/debt-consolidation" className="no-underline">
            <Button variant="ghost">{tIcomponents_CreditCardTool("t_ac9dc79a")}</Button>
          </Link>
          <Link href="/bank-fees" className="no-underline">
            <Button variant="ghost">{tIcomponents_CreditCardTool("t_a5b579f8")}</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
