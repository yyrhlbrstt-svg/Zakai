"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, Button, Textarea } from "@/components/ui";
import { analyzeSpending, type SpendingSummary, type SpendCategory } from "@/lib/spending";
import { formatAgorot } from "@/lib/money";

/** Stable colour per category (works in both themes; matches the app palette). */
const CATEGORY_COLOR: Record<SpendCategory, string> = {
  groceries: "#3fcb9b",
  dining: "#3ec6ff",
  transport: "#8b5cf6",
  shopping: "#f5a623",
  health: "#ff6b9d",
  housing: "#4dd0e1",
  bills: "#ffd166",
  entertainment: "#c792ea",
  cash: "#9aa7b2",
  other: "#5b6b7a",
};

/**
 * "Where does my money go?" — pastes a statement, runs the deterministic
 * spending engine fully client-side, and renders a category breakdown plus the
 * biggest merchants. Nothing leaves the browser.
 */
export function SpendingOverview({ bcp47 }: { bcp47: string }) {
  const t = useTranslations("spending");
  const [text, setText] = useState("");
  const [result, setResult] = useState<SpendingSummary | null>(null);
  const [empty, setEmpty] = useState(false);

  const money = (a: number) => formatAgorot(a, bcp47);

  function run() {
    const s = analyzeSpending(text);
    if (s.transactions === 0) {
      setEmpty(true);
      setResult(null);
      return;
    }
    setEmpty(false);
    setResult(s);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 sm:p-6">
        <Textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("paste")}
          aria-label={t("paste")}
          className="font-mono text-[12.5px]"
        />
        <Button onClick={run} disabled={text.trim().length === 0} className="w-full mt-4">
          {t("analyze")}
        </Button>
        {empty && <p className="text-ink-soft text-[13px] mt-3 text-center">{t("empty")}</p>}
        <p className="text-[11px] text-ink-soft mt-3 text-center leading-relaxed">{t("privacy")}</p>
      </Card>

      {result && (
        <>
          <Card className="p-6 text-center">
            <div className="text-ink-soft text-[13px]">{t("totalLabel")}</div>
            <div className="font-display grad-text text-[clamp(30px,7vw,44px)] leading-none tabular-nums mt-1.5">
              {money(result.totalAgorot)}
            </div>
            <div className="text-ink-soft text-[12.5px] mt-2">
              {t("txnsLabel", { count: result.transactions })}
            </div>
          </Card>

          <div>
            <h2 className="text-[15px] font-extrabold mb-3">{t("categoriesTitle")}</h2>
            <Card className="p-5 flex flex-col gap-3.5">
              {result.byCategory.map((c) => {
                const pct = Math.round(c.share * 100);
                return (
                  <div key={c.category}>
                    <div className="flex justify-between items-baseline gap-3 mb-1.5">
                      <span className="text-[13.5px] font-bold">{t(`categories.${c.category}`)}</span>
                      <span className="text-[13px] text-ink-soft tabular-nums">
                        {money(c.totalAgorot)} · {pct}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[rgba(255,255,255,0.07)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: CATEGORY_COLOR[c.category] }}
                      />
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>

          <div>
            <h2 className="text-[15px] font-extrabold mb-3">{t("merchantsTitle")}</h2>
            <Card className="py-1">
              {result.topMerchants.map((m, i, arr) => (
                <div
                  key={m.merchant}
                  className="flex justify-between items-center gap-3 px-5 py-3"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
                >
                  <span className="text-[13.5px] font-bold truncate">{m.merchant}</span>
                  <span className="text-[13px] text-ink-soft tabular-nums shrink-0">
                    {money(m.totalAgorot)}
                    {m.count > 1 && <span className="opacity-70"> · {t("occurrences", { count: m.count })}</span>}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
