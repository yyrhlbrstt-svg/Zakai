"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Input } from "@/components/ui";
import { estimatePlans, type UsageProfile } from "@/lib/electricity";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

const PROFILES: UsageProfile[] = ["spread", "day_home", "evening_family", "ev_night"];

/**
 * Electricity plan comparison — pure client-side math (lib/electricity), no
 * data leaves the device. Ranks supplier plans by estimated saving for the
 * household's bill + usage profile, honoring the smart-meter constraint.
 */
export function ElectricityCalculator({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("electricity");
  const [bill, setBill] = useState("400");
  const [profile, setProfile] = useState<UsageProfile>("spread");
  const [smartMeter, setSmartMeter] = useState(true);

  const billNum = parseFloat(bill);
  const results = useMemo(() => {
    if (!Number.isFinite(billNum) || billNum <= 0) return [];
    return estimatePlans(shekelsToAgorot(billNum), profile, smartMeter);
  }, [billNum, profile, smartMeter]);

  const money = (a: number) => formatAgorot(a, bcp47);

  return (
    <div>
      <Card className="p-6">
        <label className="block max-w-[240px]">
          <span className="text-[13.5px] text-ink-soft">{t("billLabel")}</span>
          <Input
            type="number"
            inputMode="decimal"
            min={1}
            value={bill}
            onChange={(e) => setBill(e.target.value)}
            className="mt-1.5"
          />
        </label>

        <div className="mt-5">
          <span className="text-[13.5px] text-ink-soft block mb-2">{t("profileLabel")}</span>
          <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label={t("profileLabel")}>
            {PROFILES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={profile === p}
                onClick={() => setProfile(p)}
                className={`rounded-full px-4 py-2 text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
                  profile === p
                    ? "bg-[rgba(63,203,155,0.14)] border-[rgba(63,203,155,0.5)] text-emerald"
                    : "bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-ink-soft hover:border-[rgba(255,255,255,0.2)]"
                }`}
              >
                {t(`profiles.${p}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="flex gap-2.5 items-center mt-5 text-[13.5px] cursor-pointer">
          <input
            type="checkbox"
            checked={smartMeter}
            onChange={(e) => setSmartMeter(e.target.checked)}
            className="w-[18px] h-[18px]"
          />
          <span>{t("smartMeter")}</span>
        </label>
        {!smartMeter && (
          <p className="text-[12px] text-ink-soft mt-2 mb-0 leading-snug">{t("noMeterNote")}</p>
        )}
      </Card>

      {results.length > 0 && (
        <Card className="mt-5 py-1.5">
          {results.map((r, i) => (
            <div
              key={r.plan.id}
              className="flex items-center gap-3.5 px-5 py-4 flex-wrap"
              style={{
                borderBottom: i < results.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
              }}
            >
              {i === 0 && (
                <span className="text-[10.5px] font-extrabold text-[#06121A] grad-bg rounded-full px-2 py-0.5">
                  {t("best")}
                </span>
              )}
              <div className="flex-1 basis-[170px]">
                <div className="font-extrabold text-[15px]">
                  {t(`providers.${r.plan.providerKey}`)} — {t(`planNames.${r.plan.nameKey}`)}
                </div>
                <div className="text-[11.5px] text-ink-soft mt-0.5">
                  {t("effective", { pct: r.effectivePct })}
                </div>
              </div>
              <div className="text-end">
                <div className="font-display text-lg text-emerald">
                  {money(r.monthlySavingAgorot)}
                  <span className="text-ink-soft text-[12px] font-sans"> {t("perMonth")}</span>
                </div>
                <div className="text-[11.5px] text-ink-soft">
                  {t("perYear", { amount: money(r.yearlySavingAgorot) })}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      <p className="mt-5 text-[11.5px] text-ink-soft leading-relaxed">{t("disclaimer")}</p>
    </div>
  );
}
