"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { Card, Input, Button } from "@/components/ui";
import { analyzeCreditCard } from "@/lib/creditCard";
import { Link } from "@/i18n/routing";

export function CreditCardTool() {
  const locale = useLocale();
  const he = locale === "he" || locale === "ar";
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
        <label className="text-[13px] text-ink-soft">
          {he ? "יתרת חוב בכרטיס ₪" : "Card balance ₪"}
          <Input type="number" className="mt-1" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </label>
        <label className="text-[13px] text-ink-soft">
          {he ? "ריבית שנתית %" : "Annual interest %"}
          <Input type="number" className="mt-1" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className="text-[13px] text-ink-soft">
          {he ? "תשלום מינימום % מהיתרה" : "Min payment % of balance"}
          <Input type="number" className="mt-1" value={minPct} onChange={(e) => setMinPct(e.target.value)} />
        </label>
      </Card>

      <Card className="p-6 text-center">
        <div className="text-[13px] text-ink-soft font-bold">{he ? "ריבית משוערת לחודש" : "Est. interest / month"}</div>
        <div className="font-display grad-text text-4xl mt-2">₪{result.monthlyInterestShekels.toLocaleString()}</div>
        <div className="text-[13px] text-ink-soft mt-3">
          {he ? "בשנה ≈" : "Per year ≈"} ₪{result.yearlyInterestShekels.toLocaleString()}
        </div>
        {result.monthsToClearIfMinOnly != null && (
          <div className="text-[13px] text-ink-soft mt-2">
            {he ? "רק מינימום ≈" : "Min-only ≈"} {result.monthsToClearIfMinOnly}{" "}
            {he ? "חודשים לסגירה" : "months to clear"}
          </div>
        )}
        <p className="text-[13.5px] leading-relaxed mt-4 text-ink-soft">{he ? result.tipHe : result.tipEn}</p>
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          <Link href="/debt-consolidation" className="no-underline">
            <Button variant="ghost">{he ? "איחוד הלוואות" : "Debt tools"}</Button>
          </Link>
          <Link href="/bank-fees" className="no-underline">
            <Button variant="ghost">{he ? "עמלות בנק" : "Bank fees"}</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
