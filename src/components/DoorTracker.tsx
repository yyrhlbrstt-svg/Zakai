"use client";

import { useEffect } from "react";

/**
 * Doors whose click counts as a conversion. Must cover every href in the
 * home.tsx `doorsByKey` list — a door missing here is an experiment arm that
 * can never accumulate conversions and can never be promoted, no matter how
 * well it actually performs.
 */
const CONVERSION_HREF_RE =
  /\/(money|cancel|what-am-i-owed|entitlements|electricity|incident|dormant|vehicle-check)(\/|$|\?)/;

/** Pure so the door→conversion mapping is testable without a DOM. */
export function isConversionHref(href: string): boolean {
  return CONVERSION_HREF_RE.test(href);
}

/**
 * Reports what the visitor did with the doors, so the engine has something to
 * learn from.
 *
 * Two events, and the difference between them is the whole measurement: an
 * impression on mount, and a conversion when a door is actually opened. Without
 * the impression there is no denominator, and an experiment with no denominator
 * measures popularity rather than effectiveness.
 *
 * `keepalive` on the conversion beacon because the click is navigating away —
 * a normal fetch is cancelled mid-flight and the most important half of the
 * data silently never arrives.
 */
export function DoorTracker({
  experimentId,
  armId,
}: {
  experimentId: string;
  armId: string;
}) {
  useEffect(() => {
    const report = (converted: boolean, keepalive = false) => {
      void fetch("/api/evolve/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experimentId, armId, converted }),
        keepalive,
      }).catch(() => {
        // Measurement must never be able to break the thing it measures.
      });
    };

    report(false);

    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement | null)?.closest?.("a[href]");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (isConversionHref(href)) {
        report(true, true);
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [experimentId, armId]);

  return null;
}
