"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui";
import { POLICY_TYPES, computeDuplication } from "@/lib/insurance";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";

/**
 * Interactive duplicate-insurance checker. The user ticks which cover they
 * hold privately and which through work / kupat-cholim; the engine flags
 * likely-wasteful indemnity overlaps and estimates the recoverable premium.
 * All logic is client-side + deterministic — nothing is uploaded.
 */
export function InsuranceChecker() {
  const t = useTranslations("insurance");
  const locale = useLocale() as Locale;
  const loc = bcp47[locale];

  const [priv, setPriv] = useState<Set<string>>(new Set());
  const [coll, setColl] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  };

  const result = useMemo(
    () => computeDuplication({ privateKeys: [...priv], collectiveKeys: [...coll] }),
    [priv, coll],
  );

  return (
    <div>
      {/* Two columns of the same policy list: private vs collective. */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] p-5">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 items-center">
          <div className="text-[12px] font-bold text-ink-soft">{t("policyCol")}</div>
          <div className="text-[12px] font-bold text-ink-soft text-center w-[64px]">
            {t("privateCol")}
          </div>
          <div className="text-[12px] font-bold text-ink-soft text-center w-[64px]">
            {t("collectiveCol")}
          </div>
          {POLICY_TYPES.map((p) => (
            <div key={p.key} className="contents">
              <div className="py-2.5 text-[14px] border-t border-[rgba(255,255,255,0.06)]">
                {t(`policies.${p.key}`)}
                <span className="text-[11px] text-ink-soft ms-1.5">
                  ({t(`kind.${p.kind}`)})
                </span>
              </div>
              <label className="flex justify-center py-2.5 border-t border-[rgba(255,255,255,0.06)]">
                <input
                  type="checkbox"
                  checked={priv.has(p.key)}
                  onChange={() => toggle(priv, setPriv, p.key)}
                  className="w-[18px] h-[18px] accent-emerald"
                  aria-label={`${t(`policies.${p.key}`)} — ${t("privateCol")}`}
                />
              </label>
              <label className="flex justify-center py-2.5 border-t border-[rgba(255,255,255,0.06)]">
                <input
                  type="checkbox"
                  checked={coll.has(p.key)}
                  onChange={() => toggle(coll, setColl, p.key)}
                  className="w-[18px] h-[18px] accent-emerald"
                  aria-label={`${t(`policies.${p.key}`)} — ${t("collectiveCol")}`}
                />
              </label>
            </div>
          ))}
        </div>
        <Button onClick={() => setSubmitted(true)} className="w-full mt-5">
          {t("checkBtn")}
        </Button>
      </div>

      {submitted && (
        <div className="mt-6">
          {result.wastefulMonthlyAgorot > 0 ? (
            <div className="rounded-2xl border border-[rgba(240,138,107,0.4)] bg-[rgba(240,138,107,0.07)] p-6 text-center">
              <div className="text-[13px] font-bold text-ink-soft">{t("resultTitle")}</div>
              <div className="font-display grad-text text-[clamp(28px,7vw,40px)] leading-none tabular-nums mt-2">
                {formatAgorot(result.wastefulYearlyAgorot, loc)}
              </div>
              <div className="text-[13px] text-ink-soft mt-2">{t("resultPerYear")}</div>
              <p className="text-[13.5px] text-ink mt-4 max-w-[520px] mx-auto leading-relaxed">
                {t("resultExplain")}
              </p>
              {result.stackableCount > 0 && (
                <p className="text-[12.5px] text-ink-soft mt-3">
                  {t("stackableNote", { count: result.stackableCount })}
                </p>
              )}
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                <Link href="/check">
                  <Button>{t("cta")}</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.06)] p-6 text-center">
              <div className="text-[34px] mb-1.5" aria-hidden>
                ✓
              </div>
              <div className="font-display text-xl">{t("noneTitle")}</div>
              <div className="text-ink-soft text-[13.5px] mt-1.5 max-w-[460px] mx-auto">
                {result.stackableCount > 0 ? t("noneStackable") : t("noneSub")}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
