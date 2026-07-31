/**
 * The Claim Outcome Oracle — the asset nobody else can build.
 *
 * WHAT IT IS
 *
 * Given a claim — this right, against this counterparty, in this jurisdiction —
 * it answers three questions with a number and an honest error bar: will it be
 * paid, how much, and how long.
 *
 * WHY IT CANNOT BE COPIED
 *
 * The answer requires knowing which specific request, to which specific
 * institution, actually resulted in money moving. Nobody has that:
 *
 *   - An institution knows its own outcomes and none of its competitors'.
 *   - A law firm has anecdotes and a survivorship bias.
 *   - A regulator sees complaints, which are the failures, not the successes.
 *   - An AI vendor has the text of requests and no idea what happened next.
 *
 * Zakai sits at the only point where the request and the payment are both
 * observed, for many claimants against many institutions. That vantage point is
 * not a feature anyone can ship; it is a consequence of doing the work at
 * volume, and it compounds.
 *
 * WHY IT IS WORTH MORE THAN THE CLAIMS THEMSELVES
 *
 * A calibrated probability of payment is a pricing primitive. Once you can say
 * "this claim pays with probability 0.71, mean 3,400, within 30 days" and be
 * right about it in aggregate, you can underwrite claims, insure them, advance
 * against them, and tell an institution what it is about to be asked for.
 * Those are all businesses that are larger than fee-taking, and every one of
 * them is downstream of this one function being trustworthy.
 *
 * WHICH IS WHY CALIBRATION IS THE PRODUCT
 *
 * An uncalibrated probability is not a worse number, it is a different kind of
 * object — it cannot be multiplied by money. A model that says 0.8 and is right
 * 55% of the time will bankrupt anyone who prices on it, and will do so while
 * looking accurate on the cases it gets right. So this module refuses to emit a
 * confident prediction it cannot stand behind, and `calibration.ts` measures
 * whether the numbers it does emit deserve the trust.
 *
 * Deterministic: same evidence in, same prediction out, no sampling. A price
 * that moves when nothing changed is not a price.
 */

export interface OutcomeQuery {
  market: string;
  vertical: string;
  counterparty: string;
  /** Optional: the specific entitlement, when it is known. */
  rightId?: string;
}

/** One settled claim, as the ledger records it. No personal data. */
export interface ClaimObservation {
  market: string;
  vertical: string;
  counterparty: string;
  rightId?: string;
  paid: boolean;
  /** Recovered amount in minor units; 0 when not paid. */
  recoveredMinor: number;
  /** Days from send to resolution. */
  days: number;
}

export type EvidenceLevel = "right" | "counterparty" | "vertical" | "market" | "none";

export interface Prediction {
  /** Posterior mean probability of payment. */
  paidProbability: number;
  /** 90% credible interval. Width is the honest statement of what we know. */
  interval: [number, number];
  /** Expected recovery when paid, in minor units. */
  expectedAmountMinor: number;
  /** Median days to resolution — median, not mean: the tail is long and skews it. */
  expectedDays: number;
  /** Probability times amount: the number a pricing decision actually uses. */
  expectedValueMinor: number;
  evidence: { level: EvidenceLevel; trials: number };
  /**
   * False when the evidence cannot support a price. A caller underwriting money
   * must check this; a caller showing a hint to a consumer may ignore it.
   */
  confident: boolean;
}

/** Weak prior: one imagined success, one imagined failure. */
const PRIOR_ALPHA = 1;
const PRIOR_BETA = 1;
/**
 * How much a parent level may contribute, in pseudo-observations.
 *
 * Bounded, not proportional — and the calibration test is what proved it has to
 * be. Weighting a parent by a fraction of its own size means a broad level with
 * ten thousand observations contributes thousands of pseudo-observations and
 * drowns a specific cell that has hundreds of its own. The predictions all
 * collapse toward the pooled average, which looks reasonable case by case and
 * shows up as an expected calibration error of 11% in aggregate: exactly the
 * quiet, expensive failure `calibration.ts` exists to catch.
 *
 * Capping it makes the parent a genuine prior — informative when a cell is
 * cold, overwhelmed as soon as the cell has real evidence of its own, which is
 * what shrinkage is supposed to do.
 */
const PARENT_PRIOR_STRENGTH = 25;
/** Each step further out is worth less again. */
const BACKOFF = 0.4;
/**
 * Below this, no price.
 *
 * Set at a hundred after the bounded-prior fix, not before it. Forty settled
 * claims produce a 90% band about eleven points wide, which reads as precise
 * and is not: priced against real money it is the difference between a healthy
 * book and an insolvent one. The threshold that protects a consumer's afternoon
 * and the one that protects a balance sheet are not the same number, and this
 * is the second.
 */
const MIN_TRIALS_FOR_CONFIDENCE = 100;
/**
 * And the interval must be tight enough to mean something. A wide 90% band is a
 * confession, not a forecast — and a caller multiplying its midpoint by a
 * shekel figure will never see the confession.
 *
 * Set at 0.14, which is a real constraint rather than a decorative one. At 0.20
 * it was unreachable: interval width shrinks as 1/sqrt(n), so anything that
 * cleared the hundred-claim floor was already inside it and this gate never
 * fired once. A safety check that cannot fail is worse than none — it reads as
 * two independent protections in the code and behaves as one.
 *
 * At 0.14 the two gates genuinely differ. A hundred claims split evenly gives a
 * band of 0.162 and is refused; the same hundred at a lopsided rate is much
 * tighter and passes. That is the right behaviour, because a rate near a half is
 * exactly where being seven points wrong flips a pricing decision.
 */
const MAX_INTERVAL_WIDTH = 0.14;

// ---------------------------------------------------------------------------
// Exact Beta quantiles — no sampling, so a price never moves on its own
// ---------------------------------------------------------------------------

function logGamma(x: number): number {
  // Lanczos approximation; accurate well past what probabilities require.
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < g.length; i++) a += g[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta (Lentz's method). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const TINY = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return h;
}

/** Regularised incomplete beta — the Beta CDF. */
export function betaCdf(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Beta quantile by bisection on the CDF. Deterministic and monotone. */
export function betaQuantile(p: number, a: number, b: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (betaCdf(mid, a, b) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Prediction
// ---------------------------------------------------------------------------

function matches(o: ClaimObservation, q: OutcomeQuery, level: EvidenceLevel): boolean {
  if (level === "none") return false;
  if (o.market !== q.market) return false;
  if (level === "market") return true;
  if (o.vertical !== q.vertical) return false;
  if (level === "vertical") return true;
  if (o.counterparty !== q.counterparty) return false;
  if (level === "counterparty") return true;
  return Boolean(q.rightId) && o.rightId === q.rightId;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Predict the outcome of a claim.
 *
 * Evidence flows from the most specific level that has any, backing off through
 * counterparty, vertical and market, each step discounted. Evidence never
 * crosses a market border: what a British utility pays says nothing about an
 * Israeli one, and pooling them would produce a confident number about nowhere.
 */
export function predictOutcome(
  query: OutcomeQuery,
  observations: readonly ClaimObservation[],
): Prediction {
  const levels: EvidenceLevel[] = query.rightId
    ? ["right", "counterparty", "vertical", "market"]
    : ["counterparty", "vertical", "market"];

  let alpha = PRIOR_ALPHA;
  let beta = PRIOR_BETA;
  let level: EvidenceLevel = "none";
  let trials = 0;
  let amounts: number[] = [];
  let durations: number[] = [];

  levels.forEach((candidate, depth) => {
    const bucket = observations.filter((o) => matches(o, query, candidate));
    if (bucket.length === 0) return;

    const wins = bucket.filter((o) => o.paid).length;

    if (depth === 0) {
      // The most specific level counts in full: this is the evidence, not a
      // prior about it.
      alpha += wins;
      beta += bucket.length - wins;
    } else {
      // Parents enter as a bounded prior at their observed rate, so their
      // influence fades as the specific cell fills up instead of dominating it.
      const rate = wins / bucket.length;
      const strength = Math.min(bucket.length, PARENT_PRIOR_STRENGTH) * Math.pow(BACKOFF, depth);
      alpha += rate * strength;
      beta += (1 - rate) * strength;
    }

    if (level === "none") {
      level = candidate;
      trials = bucket.length;
      // Amount and duration come from the most specific level only. Blending a
      // British council's timelines into an Israeli municipality's would make
      // the headline number worse, not more robust.
      amounts = bucket.filter((o) => o.paid).map((o) => Math.max(0, o.recoveredMinor));
      durations = bucket.filter((o) => o.paid).map((o) => Math.max(0, o.days));
    }
  });

  const paidProbability = alpha / (alpha + beta);
  const interval: [number, number] = [
    betaQuantile(0.05, alpha, beta),
    betaQuantile(0.95, alpha, beta),
  ];
  const expectedAmountMinor = amounts.length
    ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length)
    : 0;

  return {
    paidProbability,
    interval,
    expectedAmountMinor,
    expectedDays: median(durations),
    expectedValueMinor: Math.round(paidProbability * expectedAmountMinor),
    evidence: { level, trials },
    confident:
      trials >= MIN_TRIALS_FOR_CONFIDENCE &&
      interval[1] - interval[0] <= MAX_INTERVAL_WIDTH &&
      amounts.length > 0,
  };
}

/**
 * Rank claims by what they are actually worth pursuing.
 *
 * Expected value, not probability. A 95% chance of ₪40 is worth less than a 40%
 * chance of ₪4,000, and sorting a person's to-do list by likelihood quietly
 * sends them to do the easy, worthless ones first.
 */
export function rankByExpectedValue(
  queries: readonly OutcomeQuery[],
  observations: readonly ClaimObservation[],
): { query: OutcomeQuery; prediction: Prediction }[] {
  return queries
    .map((query) => ({ query, prediction: predictOutcome(query, observations) }))
    .sort((a, b) => b.prediction.expectedValueMinor - a.prediction.expectedValueMinor);
}
