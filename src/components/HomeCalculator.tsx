"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { bcp47, type Locale } from "@/i18n/config";
import { Card } from "@/components/ui";

/** Interactive mobile-savings estimator. Honest range, clearly an estimate. */
export function HomeCalculator() {
  const t = useTranslations("calc");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const [cell, setCell] = useState(100);

  const fmt = new Intl.NumberFormat(bcp47[locale]);
  const low = Math.round(cell * 0.1 * 12);
  const high = Math.round(cell * 0.25 * 12);

  return (
    <Card className="p-6 relative overflow-hidden">
      <div
        className="absolute -top-16 -end-16 w-52 h-52 rounded-full"
        style={{ background: "#2CE5A7", filter: "blur(70px)", opacity: 0.22 }}
        aria-hidden
      />
      <div className="relative">
        <div className="font-display text-xl">{t("title")}</div>
        <div className="text-ink-soft text-[13px] mt-1 mb-5">{t("sub")}</div>

        <div className="mb-3.5">
          <div className="flex justify-between text-[13.5px] mb-1.5">
            <span className="font-bold">📱 {t("cell")}</span>
            <span className="text-emerald font-extrabold">
              ₪{cell} {tc("perMonthTag")}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={500}
            step={10}
            value={cell}
            onChange={(e) => setCell(Number(e.target.value))}
            aria-label={t("cell")}
          />
        </div>

        <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.09)] text-center">
          <div className="text-[12.5px] text-ink-soft font-bold">{t("result")}</div>
          <div className="font-display grad-text text-4xl mt-1.5">
            ₪{fmt.format(low)}–₪{fmt.format(high)}
          </div>
          <div className="text-[11px] text-ink-soft mt-2 leading-relaxed">{t("note")}</div>
        </div>
      </div>
    </Card>
  );
}
