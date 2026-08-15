"use client";

import { useEffect, useState } from "react";
import { formatAgorot } from "@/lib/money";
import { FeePayButton } from "@/components/FeePayButton";

/**
 * The one moment in the app that should feel like a small win, not another
 * status card: the count-up + soft glow give the confirmed saving a beat of
 * its own, the way a payment app animates a transfer landing.
 */
export function SavingRevealCard({
  title,
  amountAgorot,
  perMonthTag,
  sub,
  bcp47,
  feeTag,
  feeAmountAgorot,
  feeCaseId,
}: {
  title: string;
  amountAgorot: number;
  perMonthTag: string | null;
  sub: string;
  bcp47: string;
  feeTag?: string;
  feeAmountAgorot?: number;
  feeCaseId?: string;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (amountAgorot <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(amountAgorot);
      return;
    }
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic — fast start, gentle landing, like the number is settling.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(amountAgorot * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [amountAgorot]);

  return (
    <div className="saving-reveal rounded-2xl border border-[rgba(63,203,155,0.5)] bg-[rgba(63,203,155,0.14)] px-5 py-4 mb-5 relative overflow-hidden">
      <div className="saving-reveal-glow" aria-hidden />
      <div className="font-display text-2xl grad-text m-0">{title}</div>
      {amountAgorot > 0 ? (
        <div className="saving-reveal-amount font-display text-3xl font-black text-emerald mt-2">
          {formatAgorot(shown, bcp47)}
          {perMonthTag}
        </div>
      ) : null}
      <p className="text-[13.5px] text-ink-soft mt-2 mb-0 leading-relaxed">{sub}</p>
      {feeTag && feeAmountAgorot && feeAmountAgorot > 0 && feeCaseId ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-body font-bold text-ink-soft">
            {feeTag}: {formatAgorot(feeAmountAgorot, bcp47)}
          </span>
          <FeePayButton caseId={feeCaseId} />
        </div>
      ) : null}
    </div>
  );
}
