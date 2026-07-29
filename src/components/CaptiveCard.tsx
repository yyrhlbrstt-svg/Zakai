"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Input, Button } from "@/components/ui";
import { formatAgorot } from "@/lib/money";
import { buildSwitchLetter } from "@/lib/captive/letters";
import { captiveFor, estimateCaptive, type CaptiveProduct } from "@/lib/captive/products";
import type { RightsProfile } from "@/lib/rights";

/**
 * Captive pricing, on screen.
 *
 * WHY IT IS NOT A NUMBER UNTIL THEY GIVE US ONE
 *
 * Every other block in this app can compute a figure from the profile alone.
 * This one cannot, and pretending otherwise would be the single most damaging
 * thing we could do here: an assumed premium multiplied by an assumed
 * overcharge produces a confident shekel amount that is wrong for almost
 * everybody, always in the flattering direction. So the card opens with the
 * market range and one field. One field is a fair price for a number that is
 * actually about them.
 *
 * WHY THE LETTER SITS UNDERNEATH
 *
 * Naming an overpay and stopping is what comparison sites do, and it is why
 * people read them and change nothing. The gap between knowing and keeping the
 * money is a paragraph addressed to a bank, and that paragraph is the product.
 */
export function CaptiveCard({ profile, bcp47 }: { profile: RightsProfile; bcp47: string }) {
  const t = useTranslations("captive");

  const products = captiveFor({
    hasMortgage: profile.hasMortgage,
    hasCarLoan: profile.hasCarLoan,
    employed: profile.employment === "employee" || profile.employment === "self_employed",
    spendsForeignCurrency: profile.spendsForeignCurrency,
    holdsSecurities: profile.holdsSecurities,
  });

  // Nothing they told us puts them in any of these. Say nothing rather than
  // list the catalogue at somebody it does not apply to.
  if (products.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-[15px] font-extrabold mb-1">{t("title")}</h2>
      <p className="text-ink-soft text-[13px] leading-relaxed mt-0 mb-3">{t("sub")}</p>
      <Card className="py-1">
        {products.map((p, i) => (
          <div
            key={p.id}
            className="px-5 py-3.5"
            style={{
              borderBottom: i < products.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}
          >
            <CaptiveRow product={p} bcp47={bcp47} />
          </div>
        ))}
      </Card>
    </div>
  );
}

function CaptiveRow({ product, bcp47 }: { product: CaptiveProduct; bcp47: string }) {
  const t = useTranslations("captive");
  // Copy/copied already exist in all four locales on the claim namespace. A
  // second translation of the word "copy" is a second thing to keep in sync.
  const tc = useTranslations("claim");
  const [monthly, setMonthly] = useState("");
  const [months, setMonths] = useState("");
  const [shown, setShown] = useState(false);
  const [letter, setLetter] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [lo, hi] = product.typicalPremiumOverMarket;
  // Displayed as a share of the current bill, matching what the estimate
  // computes. Showing "45% over market" next to a saving derived from
  // 45/145 invites the reader to spot a contradiction that is not there.
  const pct = (over: number) => Math.round((over / (1 + over)) * 100);

  const monthlyMinor = Math.round((parseFloat(monthly) || 0) * 100);
  const remaining = parseInt(months, 10) || undefined;
  const estimate =
    shown && monthlyMinor > 0 ? estimateCaptive(product, monthlyMinor, remaining) : null;

  const money = (minor: number) => formatAgorot(minor, bcp47);

  async function copy() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(`${letter.subject}\n\n${letter.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The text is on screen and selectable. A blocked clipboard is a missing
      // convenience, not something worth interrupting anyone about.
    }
  }

  return (
    <details>
      <summary className="cursor-pointer flex items-center gap-3 flex-wrap list-none">
        <span className="font-extrabold text-[14.5px] flex-1 basis-[200px]">
          {t(`products.${product.id}`)}
        </span>
        <span className="text-[11.5px] font-extrabold text-[#f0b45c] bg-[rgba(240,180,92,0.1)] border border-[rgba(240,180,92,0.3)] rounded-full px-2.5 py-1">
          {t("typicalGap", { lo: pct(lo), hi: pct(hi) })}
        </span>
      </summary>

      <div className="mt-3 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
        <p className="text-[12px] text-ink-soft m-0 mb-1">
          {product.switchableWithoutIncumbent ? t("kindNotice") : t("kindReprice")}
        </p>
        <p className="text-[11.5px] text-ink-soft m-0 mb-3 leading-relaxed">
          <span className="font-extrabold">{t("basis")}: </span>
          {product.rightToSwitch}
        </p>

        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
          <label className="block">
            <span className="text-[12px] text-ink-soft block mb-1">{t("yourCost")}</span>
            <Input
              value={monthly}
              onChange={(e) => {
                setMonthly(e.target.value);
                setShown(false);
              }}
              inputMode="decimal"
              dir="ltr"
              maxLength={9}
            />
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-soft block mb-1">{t("months")}</span>
            <Input
              value={months}
              onChange={(e) => {
                setMonths(e.target.value);
                setShown(false);
              }}
              inputMode="numeric"
              dir="ltr"
              maxLength={4}
            />
          </label>
        </div>

        <Button className="mt-3.5" onClick={() => setShown(true)}>
          {t("estimate")}
        </Button>

        {estimate && (
          <div className="mt-4">
            <div className="flex gap-5 flex-wrap">
              <div>
                <div className="text-[12px] text-ink-soft mb-0.5">{t("annual")}</div>
                <div className="font-display text-2xl" dir="ltr">
                  {money(estimate.annualSavingRangeMinor[0])}–
                  {money(estimate.annualSavingRangeMinor[1])}
                </div>
              </div>
              {estimate.lifetimeSavingRangeMinor && (
                <div>
                  <div className="text-[12px] text-ink-soft mb-0.5">{t("lifetime")}</div>
                  <div className="font-display text-2xl" dir="ltr">
                    {money(estimate.lifetimeSavingRangeMinor[0])}–
                    {money(estimate.lifetimeSavingRangeMinor[1])}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[11.5px] text-ink-soft mt-2 mb-0 leading-relaxed">
              {t("rangeNote")}
            </p>
          </div>
        )}

        <p className="text-[11.5px] text-ink-soft mt-3 mb-0 leading-relaxed">
          <span className="font-extrabold">{t("needs")}: </span>
          {product.needs.join(" · ")}
        </p>

        <Button
          variant="ghost"
          className="mt-3"
          onClick={() =>
            setLetter(
              buildSwitchLetter(product, {
                currentMonthlyMinor: monthlyMinor > 0 ? monthlyMinor : undefined,
              }),
            )
          }
        >
          {t("letter")}
        </Button>

        {letter && (
          <div className="mt-4">
            <div className="text-[13px] font-extrabold mb-2">{letter.subject}</div>
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed bg-[rgba(0,0,0,0.25)] rounded-xl p-4 m-0 max-h-80 overflow-auto">
              {letter.body}
            </pre>
            <div className="mt-3 flex gap-2 flex-wrap">
              <Button onClick={copy}>{copied ? tc("copied") : tc("copy")}</Button>
              <Button variant="ghost" onClick={() => window.print()}>
                {tc("print")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
