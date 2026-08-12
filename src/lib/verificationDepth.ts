/**
 * How much of a recurring saving has actually been observed.
 *
 * THE CONTRADICTION THIS RESOLVES
 *
 * Two numbers in this codebase disagreed about the same event. On a ₪30/month
 * saving, `documentedRecoveryMinor` recorded ₪360 into the outcome graph —
 * twelve months — while `computeFee` charged 18% of one month, ₪5.40. The graph
 * counted a year; the invoice counted a month. Both cannot be right, and the
 * field is called *documented*: eleven of those twelve months were never
 * observed by anyone.
 *
 * The resolution is not to charge for twelve. It is to stop asserting twelve,
 * and to let the number grow only when something is actually verified.
 *
 * WHAT A CYCLE IS
 *
 * One billing cycle confirmed by the vertical's own verification method — for
 * monthly packs, `before_after_bill`: a later bill showing the lower amount.
 * Every additional confirmed bill is more evidence, not less, so it earns more
 * documented months. The ladder is deliberately sub-linear and capped: a second
 * bill is much stronger evidence than the first, a fourth adds little, and
 * nothing here should ever imply a saving is permanent.
 *
 * A lump recovery has no cycles. The money either arrived or it did not, and
 * the amount is already the whole amount — so none of this applies to it.
 */

import type { FeeBasis } from "@/lib/verticals/types";

/**
 * Confirmed billing cycles → months we are willing to call documented.
 *
 * 1 → 1, 2 → 3, 3 → 6, and nothing beyond six however many bills arrive. Six
 * is the ceiling because past that the honest claim is about a habit rather
 * than a document, and this number's whole job is to stay a document.
 */
export const MONTHS_BY_CONFIRMED_CYCLE: readonly number[] = [0, 1, 3, 6];

/** The most months any amount of verification will document. */
export const MAX_DOCUMENTED_MONTHS = 6;

/**
 * Months documented by `cycles` confirmed billing cycles.
 *
 * Zero cycles documents zero months, which is the correct answer and not an
 * edge case: a case that was sent and never verified has recovered nothing
 * anyone can point to.
 */
export function documentedMonths(cycles: number): number {
  if (!Number.isFinite(cycles) || cycles <= 0) return 0;
  const whole = Math.floor(cycles);
  if (whole >= MONTHS_BY_CONFIRMED_CYCLE.length) return MAX_DOCUMENTED_MONTHS;
  return MONTHS_BY_CONFIRMED_CYCLE[whole]!;
}

/**
 * The saving this person can be shown, in minor units, for the depth verified.
 *
 * Integer agorot throughout — a documented recovery that arrives as a float is
 * how a rounding error ends up on somebody's invoice.
 */
export function documentedSavingMinor(
  savingMonthlyMinor: number,
  basis: FeeBasis,
  confirmedCycles: number,
): number {
  if (!Number.isInteger(savingMonthlyMinor) || savingMonthlyMinor < 0) {
    throw new Error(`savingMonthlyMinor must be a non-negative integer, got ${savingMonthlyMinor}`);
  }
  // A lump recovery is already whole. Multiplying it by anything would be
  // inventing a second payout that never happened.
  if (basis === "lump") return savingMonthlyMinor;
  return savingMonthlyMinor * documentedMonths(confirmedCycles);
}

/**
 * Is the depth-based fee switched on?
 *
 * Off by default, and deliberately so: charging 18% of six months instead of
 * one is a change to what people are billed, which belongs in the terms of
 * service and is the founder's decision, not a deployment's. Everything else
 * in this file — the ladder, the graph correction, the re-verification path —
 * is useful and honest with this flag off, and turning it on is one variable.
 */
export function tieredFeeEnabled(): boolean {
  return process.env.TIERED_SUCCESS_FEE === "true";
}

export interface TieredFee {
  /** Months of saving the verification supports. */
  documentedMonths: number;
  /** What the total fee should be at this depth, in agorot. */
  totalMinor: number;
  /** What is still owed given what was already charged, in agorot. Never negative. */
  dueNowMinor: number;
}

/**
 * The fee owed at a given verification depth, and how much of it is new.
 *
 * Returns the delta rather than a fresh total so a second confirmed bill bills
 * the difference and never re-bills what was already paid. `alreadyChargedMinor`
 * is what this case has been invoiced so far; a person who has paid more than
 * the ladder supports — a rate change, a refund — is owed nothing further, and
 * `dueNowMinor` floors at zero rather than going negative and quietly becoming
 * a credit nobody decided to give.
 */
export function tieredFee(
  savingMonthlyMinor: number,
  basis: FeeBasis,
  confirmedCycles: number,
  rateBps: number,
  alreadyChargedMinor = 0,
): TieredFee {
  if (!Number.isInteger(rateBps) || rateBps < 0) {
    throw new Error(`rateBps must be a non-negative integer, got ${rateBps}`);
  }
  const months = basis === "lump" ? 1 : documentedMonths(confirmedCycles);
  const documented = documentedSavingMinor(savingMonthlyMinor, basis, confirmedCycles);
  const totalMinor = Math.round((documented * rateBps) / 10_000);
  return {
    documentedMonths: months,
    totalMinor,
    dueNowMinor: Math.max(0, totalMinor - Math.max(0, alreadyChargedMinor)),
  };
}
