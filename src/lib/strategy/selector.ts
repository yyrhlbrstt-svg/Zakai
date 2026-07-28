/**
 * Choosing which approach to file — Thompson sampling with hierarchical
 * backoff, optimising expected recovery.
 *
 * WHY THOMPSON SAMPLING AND NOT "USE THE BEST ONE"
 *
 * Always picking the current leader is how a system stops learning. The first
 * variant to get a lucky early win becomes the only one that is ever tried
 * again, its lead is never tested, and a genuinely better approach that
 * happened to lose its first two coin flips is never seen again. Thompson
 * sampling fixes this without a tuning knob: draw a plausible payout rate from
 * each variant's posterior and play the winner of that draw. Variants with
 * little evidence have wide posteriors and therefore get tried; variants with
 * a lot of evidence converge and stop being second-guessed. Exploration falls
 * out of the uncertainty rather than being scheduled.
 *
 * WHY HIERARCHICAL BACKOFF
 *
 * The hardest real problem here is not the maths, it is that most cells are
 * empty. A new counterparty in a new vertical has zero observations, and that
 * is the normal case for years — every new country starts entirely cold. Rather
 * than treating each (market, vertical, counterparty) as an island, evidence
 * flows down: what works against this counterparty, backing off to this
 * vertical, backing off to this market, backing off to a deliberately weak
 * global prior. Parent evidence enters as pseudo-counts scaled below one, so it
 * informs a cold cell without ever overruling real local observations. This is
 * ordinary empirical-Bayes shrinkage, and it is what makes the first claim in
 * Poland better than a guess.
 *
 * WHY EXPECTED RECOVERY AND NOT WIN RATE
 *
 * See `types.ts`: ranking on win rate optimises the product toward small, easy
 * wins. The score sampled here is (payout probability) × (expected amount when
 * paid), so a variant is preferred when it is expected to put more money in the
 * customer's hands — which is also, not coincidentally, what Zakai is paid on.
 *
 * Every function is pure and seedable. A system that decides what letter a real
 * person's claim goes out with must be reproducible: "why did this customer get
 * this approach" has to be answerable months later, from the seed and the
 * observations, without a database.
 */

import type {
  EvidenceLevel,
  Observation,
  Selection,
  StrategyContext,
  StrategyVariant,
  VariantPosterior,
} from "./types";

/**
 * A weak global prior: one imagined success and one imagined failure. Weak on
 * purpose — two pseudo-observations are washed out by real evidence almost
 * immediately, which is the correct behaviour for a belief we invented.
 */
const PRIOR_ALPHA = 1;
const PRIOR_BETA = 1;

/**
 * How much a parent level may contribute, in pseudo-observations.
 *
 * Bounded rather than proportional. Weighting a parent by a fraction of its own
 * size means a broad level with ten thousand observations contributes thousands
 * of pseudo-observations and drowns a specific cell holding hundreds of its own
 * — every estimate collapses toward the pooled average while looking reasonable
 * case by case. The Oracle's calibration test caught exactly this shape and
 * measured it at 11% expected calibration error; the same flaw was here, in the
 * code that chooses how a real person's claim gets worded.
 *
 * Capped, a parent behaves as a prior should: informative while a cell is cold,
 * overwhelmed the moment that cell has evidence of its own.
 */
const PARENT_PRIOR_STRENGTH = 25;
const BACKOFF_WEIGHT = 0.4;

/** Fallback expected recovery when nothing has ever been recovered anywhere. */
const NEUTRAL_AMOUNT_MINOR = 10_000;

// ---------------------------------------------------------------------------
// Seedable randomness
// ---------------------------------------------------------------------------

export type Rng = () => number;

/** mulberry32 — small, fast, good enough, and above all reproducible. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function standardNormal(rng: Rng): number {
  // Box–Muller. u must be non-zero for the logarithm.
  let u = rng();
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Marsaglia–Tsang gamma sampler. */
function sampleGamma(rng: Rng, shape: number): number {
  if (shape < 1) {
    // Boost into the k >= 1 regime, then scale back down.
    let u = rng();
    while (u === 0) u = rng();
    return sampleGamma(rng, shape + 1) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = standardNormal(rng);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Beta(a, b) via two gamma draws. */
export function sampleBeta(rng: Rng, alpha: number, beta: number): number {
  const x = sampleGamma(rng, alpha);
  const y = sampleGamma(rng, beta);
  const total = x + y;
  return total === 0 ? 0.5 : x / total;
}

// ---------------------------------------------------------------------------
// Building posteriors
// ---------------------------------------------------------------------------

interface Bucket {
  trials: number;
  wins: number;
  recoveredTotal: number;
}

const EMPTY: Bucket = { trials: 0, wins: 0, recoveredTotal: 0 };

function add(bucket: Bucket | undefined, o: Observation): Bucket {
  const b = bucket ?? EMPTY;
  return {
    trials: b.trials + 1,
    wins: b.wins + (o.paid ? 1 : 0),
    recoveredTotal: b.recoveredTotal + (o.paid ? Math.max(0, o.recoveredMinor) : 0),
  };
}

function matches(a: StrategyContext, b: StrategyContext, level: EvidenceLevel): boolean {
  if (level === "prior") return true;
  if (a.market !== b.market) return false;
  if (level === "market") return true;
  if (a.vertical !== b.vertical) return false;
  if (level === "vertical") return true;
  return a.counterparty === b.counterparty;
}

/** Index observations for one context at one level of specificity. */
function bucketsAt(
  observations: readonly Observation[],
  context: StrategyContext,
  level: EvidenceLevel,
): Map<string, Bucket> {
  const out = new Map<string, Bucket>();
  for (const o of observations) {
    if (!matches(o.context, context, level)) continue;
    out.set(o.variantId, add(out.get(o.variantId), o));
  }
  return out;
}

/**
 * Build the posterior for each candidate variant, blending the levels of the
 * hierarchy. Exported because the reasoning behind a selection has to be
 * inspectable — by a test, by an operator, and eventually by a regulator
 * asking why one customer's claim was worded differently from another's.
 */
export function buildPosteriors(
  variants: readonly StrategyVariant[],
  observations: readonly Observation[],
  context: StrategyContext,
): VariantPosterior[] {
  const levels: EvidenceLevel[] = ["counterparty", "vertical", "market"];
  const byLevel = levels.map((level) => ({ level, buckets: bucketsAt(observations, context, level) }));

  // Global fallback for the amount: what a successful claim recovers on
  // average anywhere. Better than a made-up constant once anything exists.
  const globalWins = observations.filter((o) => o.paid);
  const globalMeanAmount = globalWins.length
    ? globalWins.reduce((s, o) => s + Math.max(0, o.recoveredMinor), 0) / globalWins.length
    : NEUTRAL_AMOUNT_MINOR;

  return variants.map((variant) => {
    let alpha = PRIOR_ALPHA;
    let beta = PRIOR_BETA;
    let directTrials = 0;
    let evidenceLevel: EvidenceLevel = "prior";
    let amountWeight = 0;
    let amountTotal = 0;

    levels.forEach((level, depth) => {
      const bucket = byLevel[depth].buckets.get(variant.id);
      if (!bucket || bucket.trials === 0) return;

      // The most specific level with any evidence is the one we report.
      if (evidenceLevel === "prior") {
        evidenceLevel = level;
        directTrials = bucket.trials;
      }

      if (depth === 0) {
        // This is the evidence, not a prior about it: it counts in full.
        alpha += bucket.wins;
        beta += bucket.trials - bucket.wins;
        amountWeight += bucket.wins;
        amountTotal += bucket.recoveredTotal;
      } else {
        const rate = bucket.wins / bucket.trials;
        const strength =
          Math.min(bucket.trials, PARENT_PRIOR_STRENGTH) * Math.pow(BACKOFF_WEIGHT, depth);
        alpha += rate * strength;
        beta += (1 - rate) * strength;
        // Scale the amount contribution the same way, so a parent cannot drag
        // the expected payout any harder than it drags the probability.
        const scale = bucket.wins > 0 ? strength / bucket.trials : 0;
        amountWeight += bucket.wins * scale;
        amountTotal += bucket.recoveredTotal * scale;
      }
    });

    const expectedRecoveredMinor =
      amountWeight > 0 ? amountTotal / amountWeight : globalMeanAmount;

    return { variantId: variant.id, alpha, beta, expectedRecoveredMinor, directTrials, evidenceLevel };
  });
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

export interface SelectOptions {
  rng?: Rng;
  /**
   * Skip sampling and return the current best guess. For regulated verticals
   * where every claim must be filed identically, and for previewing to the
   * customer what will be sent.
   */
  deterministic?: boolean;
}

/**
 * Choose the approach to file. Throws on an empty candidate set rather than
 * returning a null the caller will forget to handle on the path that sends a
 * real letter on someone's behalf.
 */
export function selectVariant(
  variants: readonly StrategyVariant[],
  observations: readonly Observation[],
  context: StrategyContext,
  options: SelectOptions = {},
): Selection {
  if (variants.length === 0) throw new Error("selectVariant: no candidate variants");

  const posteriors = buildPosteriors(variants, observations, context);
  const rng = options.rng ?? Math.random;

  const scored = posteriors.map((p) => {
    const rate = options.deterministic
      ? p.alpha / (p.alpha + p.beta)
      : sampleBeta(rng, p.alpha, p.beta);
    return { p, score: rate * p.expectedRecoveredMinor };
  });

  const chosen = scored.reduce((best, cur) => (cur.score > best.score ? cur : best));
  const best = posteriors.reduce((a, b) =>
    meanScore(a) >= meanScore(b) ? a : b,
  );

  return {
    variant: variants.find((v) => v.id === chosen.p.variantId)!,
    evidenceLevel: chosen.p.evidenceLevel,
    trials: chosen.p.directTrials,
    exploring: chosen.p.variantId !== best.variantId,
  };
}

function meanScore(p: VariantPosterior): number {
  return (p.alpha / (p.alpha + p.beta)) * p.expectedRecoveredMinor;
}

/**
 * Expected recovery per claim under each variant, for the operator view. This
 * is the number to watch: if the engine is working, it rises over time without
 * anyone editing a template.
 */
export function rankVariants(
  variants: readonly StrategyVariant[],
  observations: readonly Observation[],
  context: StrategyContext,
): { variantId: string; expectedMinor: number; trials: number; evidenceLevel: EvidenceLevel }[] {
  return buildPosteriors(variants, observations, context)
    .map((p) => ({
      variantId: p.variantId,
      expectedMinor: Math.round(meanScore(p)),
      trials: p.directTrials,
      evidenceLevel: p.evidenceLevel,
    }))
    .sort((a, b) => b.expectedMinor - a.expectedMinor);
}
