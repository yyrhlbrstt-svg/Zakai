import type { RecurringCharge } from "./subscriptions";

/**
 * Compare this month's recurring costs against a saved baseline, and say what
 * moved.
 *
 * WHY THIS IS THE THING BUSINESSES ACTUALLY NEED
 *
 * A one-off audit answers "what am I paying". It is useful once. The way a
 * business really loses money is slower and quieter: a supplier adds forty
 * shekels a month, a subscription renews at a higher tier, a bank introduces
 * a charge that was waived for the first year. No single increase is large
 * enough to notice on a statement, and nobody re-reads last month's statement
 * beside this one. Across half a dozen suppliers over a year it is thousands
 * of shekels that were never decided on — just absorbed.
 *
 * That is the gap. Not "what do I pay", which the statement already answers,
 * but "what changed since last time, without anyone telling me". Answering it
 * requires exactly one thing nobody has: a memory of last month. It is also
 * the reason to come back — an audit is a visit, a watch is a habit.
 *
 * WHY THIS CANNOT FABRICATE
 *
 * Every number here is the difference between two figures the user supplied.
 * There is no benchmark, no market rate, no estimate of what anything ought
 * to cost — only "you paid X, now you pay Y". That makes it the rare feature
 * that is both genuinely valuable and impossible to be dishonest with.
 */

export interface CostSnapshot {
  /** ISO date the snapshot was taken. */
  takenAt: string;
  charges: Array<Pick<RecurringCharge, "merchant" | "monthlyAgorot">>;
}

export type DriftKind = "increased" | "decreased" | "new" | "gone";

export interface DriftItem {
  merchant: string;
  kind: DriftKind;
  /** Monthly agorot then; 0 for a charge that is new. */
  beforeAgorot: number;
  /** Monthly agorot now; 0 for a charge that has stopped. */
  afterAgorot: number;
  /** Signed monthly change in agorot. Positive means it costs more now. */
  deltaAgorot: number;
}

/**
 * Statement amounts wobble — a card fee rounds differently, a usage-based
 * line varies slightly month to month. Flagging a two-shekel drift would bury
 * the real increases in noise, so movement must clear both an absolute floor
 * and a proportional one before it counts as a change rather than jitter.
 */
export const DRIFT_MIN_AGOROT = 500; // ₪5/month
export const DRIFT_MIN_RATIO = 0.03; // 3%

function significant(before: number, after: number): boolean {
  const delta = Math.abs(after - before);
  if (delta < DRIFT_MIN_AGOROT) return false;
  return before === 0 || delta / before >= DRIFT_MIN_RATIO;
}

/** Merchants match on a normalised name — casing and spacing vary by export. */
function key(merchant: string): string {
  return merchant.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * What changed between two snapshots, ordered by how much it costs now —
 * increases first, largest first, because that is the order a business should
 * spend its attention in.
 */
export function detectCostDrift(
  before: CostSnapshot,
  after: CostSnapshot,
): DriftItem[] {
  const past = new Map(before.charges.map((c) => [key(c.merchant), c]));
  const present = new Map(after.charges.map((c) => [key(c.merchant), c]));
  const items: DriftItem[] = [];

  for (const [k, now] of present) {
    const then = past.get(k);
    if (!then) {
      items.push({
        merchant: now.merchant,
        kind: "new",
        beforeAgorot: 0,
        afterAgorot: now.monthlyAgorot,
        deltaAgorot: now.monthlyAgorot,
      });
      continue;
    }
    if (!significant(then.monthlyAgorot, now.monthlyAgorot)) continue;
    items.push({
      merchant: now.merchant,
      kind: now.monthlyAgorot > then.monthlyAgorot ? "increased" : "decreased",
      beforeAgorot: then.monthlyAgorot,
      afterAgorot: now.monthlyAgorot,
      deltaAgorot: now.monthlyAgorot - then.monthlyAgorot,
    });
  }

  for (const [k, then] of past) {
    if (present.has(k)) continue;
    items.push({
      merchant: then.merchant,
      kind: "gone",
      beforeAgorot: then.monthlyAgorot,
      afterAgorot: 0,
      deltaAgorot: -then.monthlyAgorot,
    });
  }

  // Costs that went up lead, largest first; everything else follows by size.
  const rank = (i: DriftItem) => (i.kind === "increased" || i.kind === "new" ? 0 : 1);
  return items.sort(
    (a, b) => rank(a) - rank(b) || Math.abs(b.deltaAgorot) - Math.abs(a.deltaAgorot),
  );
}

/**
 * Net monthly change across everything that moved. Positive means the
 * business is paying more than it was — the number worth putting on screen.
 */
export function netMonthlyDriftAgorot(items: DriftItem[]): number {
  return items.reduce((sum, i) => sum + i.deltaAgorot, 0);
}

/** Only the costs that rose — what there is actually something to do about. */
export function increasesOnly(items: DriftItem[]): DriftItem[] {
  return items.filter((i) => i.kind === "increased" || i.kind === "new");
}

export function snapshotFromCharges(charges: RecurringCharge[], now: Date = new Date()): CostSnapshot {
  return {
    takenAt: now.toISOString(),
    charges: charges.map((c) => ({ merchant: c.merchant, monthlyAgorot: c.monthlyAgorot })),
  };
}
