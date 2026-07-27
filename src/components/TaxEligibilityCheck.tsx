"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Tax-refund eligibility quick-check. A checklist of the common situations that
 * mean a refund is likely; ticking any of them tells the user they probably
 * have money waiting and can file up to 6 years back. Pure client-side, no
 * backend — its job is to turn "maybe" into "this is me", then hand off to the
 * calculator below for the amount. Honest: it says "likely", never promises.
 */
export function TaxEligibilityCheck() {
  const t = useTranslations("taxrefund.check");
  const triggers = t.raw("triggers") as string[];
  const [checked, setChecked] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const n = checked.size;

  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] p-5 sm:p-6 mb-6">
      <div className="font-extrabold text-[16px]">{t("title")}</div>
      <div className="text-ink-soft text-[13px] mt-1 mb-4">{t("sub")}</div>

      <ul className="flex flex-col gap-2 list-none p-0 m-0">
        {triggers.map((label, i) => {
          const on = checked.has(i);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-pressed={on}
                className={`w-full flex items-start gap-3 text-start rounded-xl border px-3.5 py-2.5 transition-colors ${
                  on
                    ? "border-[rgba(63,203,155,0.5)] bg-[rgba(63,203,155,0.08)]"
                    : "border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(63,203,155,0.3)]"
                }`}
              >
                <span
                  className={`mt-0.5 w-[18px] h-[18px] shrink-0 rounded-[6px] border flex items-center justify-center text-[11px] font-black ${
                    on
                      ? "grad-bg text-[#06121A] border-transparent"
                      : "border-[rgba(255,255,255,0.25)] text-transparent"
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span className="text-[13.5px] leading-snug">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        className={`mt-4 rounded-xl px-4 py-3 text-[13.5px] leading-relaxed ${
          n > 0
            ? "border border-[rgba(63,203,155,0.35)] bg-[rgba(63,203,155,0.07)]"
            : "border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] text-ink-soft"
        }`}
        aria-live="polite"
      >
        {n > 0 ? (
          <>
            <span className="font-bold text-emerald">{t("hit", { n })}</span>{" "}
            <span className="text-ink-soft">{t("hitCta")}</span>
          </>
        ) : (
          t("none")
        )}
      </div>
    </div>
  );
}
