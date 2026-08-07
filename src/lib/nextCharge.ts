/**
 * When is this charge coming again?
 *
 * THE GAP THIS CLOSES
 *
 * `detectRecurring` already sorts each merchant's charges by date and measures
 * the gaps between them — that is how it decides something recurs at all. Then
 * it discards every date and returns an amount. So the product could say "you
 * pay ₪54.90 a month for this" and could not say "and it will be taken again
 * on Tuesday", from the same data it had just finished reading.
 *
 * That difference is the whole distinction between recovering money and
 * keeping it. Cancelling before a charge costs nothing; cancelling after means
 * chasing a refund from a company with no reason to hurry, which is the slow,
 * uncertain path this product exists to spare people.
 *
 * WHAT IT REFUSES TO DO
 *
 * A prediction shown as a certainty is worse than no prediction: someone skips
 * a cancellation because we told them they had a week. So every estimate
 * carries how it was derived, two observations never produce a confident one,
 * and an interval that does not look like a real billing cycle is reported as
 * irregular rather than averaged into a number that looks precise.
 */

export const DAY_MS = 86_400_000;

/** Cycles worth recognising, with the tolerance each is matched within. */
const CYCLES = [
  { days: 7, tolerance: 2, label: "weekly" as const },
  { days: 14, tolerance: 3, label: "fortnightly" as const },
  { days: 30, tolerance: 6, label: "monthly" as const },
  { days: 91, tolerance: 12, label: "quarterly" as const },
  { days: 365, tolerance: 30, label: "yearly" as const },
];

export type CycleLabel = (typeof CYCLES)[number]["label"] | "irregular";

export type Confidence = "high" | "low";

export interface NextChargeEstimate {
  /** Typical days between charges, median of observed gaps. */
  intervalDays: number;
  cycle: CycleLabel;
  /** Last charge actually observed. */
  lastChargeAt: Date;
  /** Estimated next charge. Never in the past — rolled forward from today. */
  nextChargeAt: Date;
  /**
   * "high" needs at least three charges (two gaps) that agree on a real
   * billing cycle. Two charges give one gap, which cannot be checked against
   * anything, so it is always "low" no matter how clean it looks.
   */
  confidence: Confidence;
  /** Whole days from `now` until the estimate. 0 means today. */
  daysUntil: number;
}

/**
 * Estimate the next charge from observed dates.
 *
 * Returns null when there is genuinely nothing to say — fewer than two
 * charges, or gaps too erratic to call a cycle.
 */
export function estimateNextCharge(
  dates: readonly Date[],
  now: Date = new Date(),
): NextChargeEstimate | null {
  const sorted = [...dates]
    .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (sorted.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].getTime() - sorted[i - 1].getTime()) / DAY_MS;
    // A same-day duplicate is a split payment, not a cycle.
    if (gap >= 1) gaps.push(gap);
  }
  if (gaps.length === 0) return null;

  const intervalDays = Math.round(median(gaps));
  if (intervalDays < 1) return null;

  const matched = CYCLES.find((c) => Math.abs(intervalDays - c.days) <= c.tolerance);
  if (!matched) return null;

  /**
   * How far apart the gaps themselves are. The median alone is not enough:
   * gaps of 3 and 31 days have a median of 17, which sits inside the
   * fortnightly tolerance and would be reported as a clean fortnightly cycle.
   * That is precisely the invented cadence this must not produce, so the
   * spread is checked before the cycle is believed at all.
   */
  const spread = Math.max(...gaps) - Math.min(...gaps);
  if (spread > matched.tolerance * 2) return null;

  const cycle: CycleLabel = matched.label;

  const lastChargeAt = sorted[sorted.length - 1];

  // Roll forward whole cycles until the estimate is in the future, so a
  // statement uploaded weeks late still names the NEXT charge rather than one
  // that already happened.
  let nextChargeAt = new Date(lastChargeAt.getTime() + intervalDays * DAY_MS);
  const startOfToday = atMidnight(now);
  while (nextChargeAt.getTime() < startOfToday.getTime()) {
    nextChargeAt = new Date(nextChargeAt.getTime() + intervalDays * DAY_MS);
  }

  // Confidence is about agreement between gaps, not agreement with their own
  // median — every set of gaps agrees with its median by construction.
  const consistent = gaps.length >= 2 && spread <= matched.tolerance;

  return {
    intervalDays,
    cycle,
    lastChargeAt,
    nextChargeAt,
    confidence: consistent ? "high" : "low",
    daysUntil: Math.round((atMidnight(nextChargeAt).getTime() - startOfToday.getTime()) / DAY_MS),
  };
}

/**
 * Charges worth acting on before they land, soonest first.
 *
 * `withinDays` is the window in which cancelling still beats refunding. It is
 * a caller's decision, not a constant here, because the useful window differs
 * by how long the counterparty takes to action a cancellation.
 */
export function chargesDueWithin<T extends { next: NextChargeEstimate | null }>(
  items: readonly T[],
  withinDays: number,
): T[] {
  return items
    .filter((i) => i.next !== null && i.next.daysUntil >= 0 && i.next.daysUntil <= withinDays)
    .sort((a, b) => (a.next?.daysUntil ?? 0) - (b.next?.daysUntil ?? 0));
}

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
