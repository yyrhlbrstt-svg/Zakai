"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { maxBreakevenSavingAgorot, PLANS } from "@/lib/plans";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

/** Interactive breakeven for Max — no fabricated savings claims. */
export function MaxPlanRoi({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("pricing");
  const [monthlyShekels, setMonthlyShekels] = useState(400);
  const savingAgorot = shekelsToAgorot(monthlyShekels);

  const fromFree = useMemo(() => maxBreakevenSavingAgorot("FREE"), []);
  const fromPro = useMemo(() => maxBreakevenSavingAgorot("PRO"), []);

  const feeFree = Math.round((savingAgorot * PLANS.FREE.feeRateBps) / 10000);
  const feePro = Math.round((savingAgorot * PLANS.PRO.feeRateBps) / 10000);
  const maxPrice = PLANS.MAX.priceAgorot;
  const worthVsFree = feeFree >= maxPrice;
  const worthVsPro = feePro >= maxPrice;

  const money = (a: number) => formatAgorot(a, bcp47);

  return (
    <Card className="mt-8 p-6">
      <h2 className="font-display text-xl m-0">{t("maxRoiTitle")}</h2>
      <p className="text-ink-soft text-[13.5px] mt-2 mb-5 leading-relaxed">{t("maxRoiSub")}</p>
      <label className="block">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-[13px] text-ink-soft">{t("maxRoiInput")}</span>
          <span className="font-display text-[15px]">{money(savingAgorot)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={2000}
          step={50}
          value={monthlyShekels}
          onChange={(e) => setMonthlyShekels(Number(e.target.value))}
          aria-label={t("maxRoiInput")}
        />
      </label>
      <p className="text-[13px] text-ink-soft mt-4 mb-0 leading-relaxed">
        {worthVsFree || worthVsPro ? t("maxRoiYes") : t("maxRoiNo")}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5 list-none p-0 m-0 text-[12.5px] text-ink-soft">
        <li>
          {t("maxRoiBreakevenFree", { amount: money(fromFree) })}
        </li>
        <li>
          {t("maxRoiBreakevenPro", { amount: money(fromPro) })}
        </li>
      </ul>
    </Card>
  );
}
