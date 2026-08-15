"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui";
import { CONSUMER_PLAN_IDS, advisePlan, crossoverAgorot } from "@/lib/planForSaving";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

/**
 * Which plan actually costs this person the least — including "stay on Free".
 *
 * WHAT THIS USED TO GET WRONG
 *
 * It asked whether Max beat Free *or* Pro, and called that "worth it". Those
 * are different questions, and between roughly ₪333 and ₪444 of monthly
 * saving the answer diverges: Max's subscription is cheaper than Free's 18%
 * fee, while Pro is cheaper still. The slider's default sat at ₪400, squarely
 * inside that band, so the page opened by recommending the pricier tier to
 * someone a cheaper one would have served.
 *
 * The crossovers now come from `planForSaving`, which compares every plan
 * against every other and is free to answer "stay on Free" — a recommendation
 * that can never say "don't upgrade" is not a recommendation, it is an ad.
 */
export function MaxPlanRoi({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("pricing");
  const [monthlyShekels, setMonthlyShekels] = useState(400);
  const savingAgorot = shekelsToAgorot(monthlyShekels);

  const advice = useMemo(() => advisePlan(savingAgorot, CONSUMER_PLAN_IDS), [savingAgorot]);
  // Computed from PLANS rather than written into copy, so the numbers cannot
  // drift away from the prices they describe.
  const proFrom = useMemo(() => crossoverAgorot("PRO", 500_000, CONSUMER_PLAN_IDS), []);
  const maxFrom = useMemo(() => crossoverAgorot("MAX", 500_000, CONSUMER_PLAN_IDS), []);

  const money = (a: number) => formatAgorot(a, bcp47);
  // The plans have no display name in PLANS; the id is the name users see.
  const planLabel = (id: string) => id.charAt(0) + id.slice(1).toLowerCase();

  const verdict =
    advice.best.planId === "FREE"
      ? t("maxRoiStayFree")
      : advice.worthSwitching
        ? t("maxRoiCheapestSaves", {
            plan: planLabel(advice.best.planId),
            amount: money(advice.savesAgorot),
          })
        : // The difference is real but too small to steer anyone on. Naming the
          // cheapest plan without dressing a few shekels a year as a reason to
          // switch is the honest middle.
          t("maxRoiCheapest", { plan: planLabel(advice.best.planId) });

  return (
    <Card className="mt-8 p-6">
      <h2 className="font-display text-xl m-0">{t("maxRoiTitle")}</h2>
      <p className="text-ink-soft text-[13.5px] mt-2 mb-5 leading-relaxed">{t("maxRoiSub")}</p>
      <label className="block">
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-body text-ink-soft">{t("maxRoiInput")}</span>
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
      <p className="text-body text-ink-soft mt-4 mb-0 leading-relaxed">{verdict}</p>
      <ul className="mt-3 flex flex-col gap-1.5 list-none p-0 m-0 text-[12.5px] text-ink-soft">
        {proFrom !== null && (
          <li>{t("maxRoiProFrom", { amount: money(proFrom) })}</li>
        )}
        {maxFrom !== null && <li>{t("maxRoiMaxFrom", { amount: money(maxFrom) })}</li>}
      </ul>
    </Card>
  );
}
