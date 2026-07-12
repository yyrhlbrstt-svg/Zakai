"use client";

import { useEffect, useState } from "react";

/**
 * The signature moment: the amount "settles" from the old figure down to the
 * new, lower one — a physical sense of weight being lifted, not a celebration.
 * Reduced-motion shows the final number immediately.
 */
export function FallNumber({
  from,
  to,
  locale,
  duration = 1600,
}: {
  from: number;
  to: number;
  locale: string;
  duration?: number;
}) {
  const [val, setVal] = useState(from);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVal(to);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic: a soft landing
      setVal(Math.round(from - (from - to) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration]);

  return <span>₪{new Intl.NumberFormat(locale).format(val)}</span>;
}
