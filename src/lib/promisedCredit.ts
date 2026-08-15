import type { RecurringCharge } from "./subscriptions";

/**
 * They said they would credit you. Did the money actually arrive?
 *
 * THE PROBLEM, WHICH NOTHING RECONCILES
 *
 * A supplier agrees a ₪3,000 credit on a call. A bank waives a fee "on the
 * next statement". A telecom promises two months back. Everyone writes it
 * down, nobody checks — because checking means holding a promise made in
 * March against a statement that arrives in May, and no system holds both.
 * The promise lives in an inbox; the statement lives in a bank app; the
 * person who made the call has moved on.
 *
 * So the most reliable way to not pay someone is to promise to pay them and
 * let it be forgotten. That is not fraud, it is drift, and it is worth
 * enormous amounts in aggregate precisely because each instance is too small
 * to chase from memory.
 *
 * Zakai holds both halves and nothing else does: the promise, extracted from
 * the provider's own reply, and the statement, from the scan. This is the
 * reconciliation between them.
 *
 * WHY IT IS DELIBERATELY STRICT ABOUT "ARRIVED"
 *
 * Telling somebody a credit landed when it did not is worse than staying
 * quiet: they stop looking, and the money is gone for good. So a credit only
 * counts as arrived on evidence in the statement, a partial credit is
 * reported as partial rather than rounded up to settled, and a promise that
 * cannot yet be judged is reported as pending rather than assumed good.
 */

export type CreditState =
  | "arrived" // the full amount showed up
  | "partial" // some of it did
  | "missing" // due, and nothing came
  | "pending"; // not due yet, or no statement covering the period

export interface PromisedCredit {
  counterparty: string;
  /** What they said they would credit, in minor units. */
  promisedMinor: number;
  /** When the promise was made. */
  promisedAt: Date;
  /** By when they said it would appear. Null when they did not say. */
  dueBy: Date | null;
}

export interface CreditVerdict {
  counterparty: string;
  promisedMinor: number;
  /** Credit observed in the statement, in minor units. */
  observedMinor: number;
  /** Still owed. Never negative — an overpayment is not a debt to them. */
  shortfallMinor: number;
  state: CreditState;
  /** Days since the promise was made. */
  ageDays: number;
}

/**
 * A promise with no stated date is given this long before it is called
 * missing. Two statement cycles: long enough that a normal billing lag is not
 * mistaken for a broken promise, short enough to still be worth chasing.
 */
export const GRACE_DAYS = 62;

/** Below this, a shortfall is rounding rather than a broken promise. */
export const TOLERANCE_MINOR = 500; // ₪5

/**
 * Reconcile one promise against credits seen since it was made.
 *
 * `creditsMinor` is the total credited by that counterparty in statements
 * covering the period — supplied by the caller, because deciding which
 * statement lines are credits from that counterparty is the scan's job, not
 * this function's.
 */
export function reconcileCredit(
  promise: PromisedCredit,
  creditsMinor: number,
  now: Date = new Date(),
): CreditVerdict {
  const promised = Math.max(0, Math.round(promise.promisedMinor));
  const observed = Math.max(0, Math.round(creditsMinor));
  const shortfall = Math.max(0, promised - observed);
  const ageDays = Math.max(
    0,
    Math.round((midnight(now).getTime() - midnight(promise.promisedAt).getTime()) / 86_400_000),
  );

  const base = {
    counterparty: promise.counterparty,
    promisedMinor: promised,
    observedMinor: observed,
    shortfallMinor: shortfall,
    ageDays,
  };

  if (shortfall <= TOLERANCE_MINOR) return { ...base, shortfallMinor: 0, state: "arrived" };

  // Not yet due: a promise cannot be broken before its date, and calling it
  // missing early trains people to ignore the alert.
  const due = promise.dueBy
    ? midnight(now).getTime() >= midnight(promise.dueBy).getTime()
    : ageDays >= GRACE_DAYS;
  if (!due) return { ...base, state: "pending" };

  return { ...base, state: observed > 0 ? "partial" : "missing" };
}

/**
 * Promises worth chasing, largest shortfall first.
 *
 * Pending ones are excluded: chasing a promise before its date spends
 * credibility on something that may still be perfectly on track.
 */
export function unfulfilled(verdicts: readonly CreditVerdict[]): CreditVerdict[] {
  return verdicts
    .filter((v) => v.state === "missing" || v.state === "partial")
    .sort((a, b) => b.shortfallMinor - a.shortfallMinor);
}

/** Total still owed across every broken promise, in minor units. */
export function outstandingMinor(verdicts: readonly CreditVerdict[]): number {
  return unfulfilled(verdicts).reduce((sum, v) => sum + v.shortfallMinor, 0);
}

/**
 * Total credited by a counterparty in a scan.
 *
 * Credits are the positive side of a statement. The scanner normalises debits
 * to positive monthly figures, so credits are identified by the caller and
 * passed in — this only sums what it is given for the named counterparty,
 * matching merchants the same way the rest of the product does.
 */
export function creditsFrom(
  charges: readonly RecurringCharge[],
  counterparty: string,
): number {
  const key = normalize(counterparty);
  return charges
    .filter((c) => normalize(c.merchant) === key || normalize(c.providerKey ?? "") === key)
    .reduce((sum, c) => sum + Math.max(0, Math.round(c.monthlyAgorot)), 0);
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
