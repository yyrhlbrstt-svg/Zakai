"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { computeZakameter } from "@/lib/zakameter";
import { AGENTIC_VERTICAL_COUNT } from "@/lib/toolsCatalog";
import { formatAgorot, shekelsToAgorot } from "@/lib/money";

/**
 * Quick estimate — always funnels into Money Hub so the closed loop is the
 * product, not a quiz destination.
 */
export function Zakameter({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("zakameter");
  const [mobile, setMobile] = useState(120);
  const [electricity, setElectricity] = useState(450);
  const [flights, setFlights] = useState(0);
  const [subs, setSubs] = useState(1);

  const r = useMemo(
    () =>
      computeZakameter({
        mobileMonthlyAgorot: shekelsToAgorot(mobile),
        electricityMonthlyAgorot: shekelsToAgorot(electricity),
        disruptedFlights: flights,
        unusedSubscriptions: subs,
      }),
    [mobile, electricity, flights, subs],
  );

  const money = (a: number) => formatAgorot(a, bcp47);

  const lines = [
    { key: "mobile", value: r.mobileYearlyAgorot },
    { key: "electricity", value: r.electricityYearlyAgorot },
    { key: "flights", value: r.flightsAgorot },
    { key: "subs", value: r.subscriptionsYearlyAgorot },
  ].filter((l) => l.value > 0);

  const counter = (
    value: number,
    set: (n: number) => void,
    max: number,
    label: string,
  ) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-body text-ink-soft">{label}</span>
      <div className="flex items-center gap-2.5" dir="ltr">
        <button
          type="button"
          aria-label="-"
          onClick={() => set(Math.max(0, value - 1))}
          className="w-11 h-11 rounded-[10px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] text-ink font-black cursor-pointer"
        >
          −
        </button>
        <span className="font-display text-lg min-w-[22px] text-center">{value}</span>
        <button
          type="button"
          aria-label="+"
          onClick={() => set(Math.min(max, value + 1))}
          className="w-11 h-11 rounded-[10px] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] text-ink font-black cursor-pointer"
        >
          +
        </button>
      </div>
    </div>
  );

  const slider = (
    value: number,
    set: (n: number) => void,
    min: number,
    max: number,
    step: number,
    label: string,
  ) => (
    <label className="block">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-body text-ink-soft">{label}</span>
        <span className="font-display text-[15px]">{money(shekelsToAgorot(value))}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
      />
    </label>
  );

  return (
    <SpotlightCard className="p-6">
      <div className="text-body font-extrabold text-emerald mb-4">{t("title")}</div>

      <div className="flex flex-col gap-4">
        {slider(mobile, setMobile, 0, 400, 10, t("mobileQ"))}
        {slider(electricity, setElectricity, 0, 1500, 25, t("electricityQ"))}
        {counter(flights, setFlights, 6, t("flightsQ"))}
        {counter(subs, setSubs, 10, t("subsQ"))}
      </div>

      <div className="mt-6 pt-5 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.09)" }}>
        <div className="text-[12.5px] text-ink-soft font-bold">{t("totalLabel")}</div>
        <div className="font-display grad-text text-[42px] leading-tight mt-1 transition-all duration-300 ease-out" aria-live="polite">
          {money(r.totalAgorot)}
        </div>
        {r.totalAgorot > 0 && (
          <p className="text-body text-ink-soft mt-2 mb-0 font-semibold">{t("ctaHint")}</p>
        )}
        {lines.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
            {lines.map((l) => (
              <span key={l.key} className="text-[11.5px] text-ink-soft">
                {t(`lines.${l.key}`)}: <span className="text-ink font-bold">{money(l.value)}</span>
              </span>
            ))}
          </div>
        )}
        {/* Single product door: Money Hub closes the loop. Quiz stays secondary. */}
        <Link href="/money#zakai-money-scan" className="no-underline">
          <Button className="mt-5 w-full">{t("cta")}</Button>
        </Link>
        <Link href="/what-am-i-owed" className="no-underline block mt-2">
          <Button variant="ghost" className="w-full !text-body">
            {t("ctaScan")}
          </Button>
        </Link>
        {/* The scope sentence is counted from the catalogue rather than typed
            here. The version that was typed said "full service today: mobile;
            electricity, flights and subscriptions are a calculator you run
            yourself" — and stayed there while all three grew a real claim
            path, along with about twenty more. Two outside reviews read that
            line and scored the product on it. A hardcoded scope claim does not
            stay true; a counted one cannot go stale. */}
        <p className="text-[10.5px] text-ink-soft mt-3 mb-0 leading-snug">
          {t("note", { verticals: AGENTIC_VERTICAL_COUNT })}
        </p>
      </div>
    </SpotlightCard>
  );
}
