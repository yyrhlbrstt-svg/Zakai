/**
 * The decide / observe / promote loop.
 *
 * Pure and seedable, like the strategy selector — a system that changes the
 * product on its own has to be reproducible, or "why did it do that" is
 * unanswerable and nobody will let it near anything that matters.
 *
 * The optimiser is deliberately the boring part. Thompson sampling over Beta
 * posteriors, same as `strategy/selector.ts`, for the same reason: always
 * playing the leader stops the learning, and scheduled exploration needs a
 * knob nobody tunes. The interesting code below is `review()`, which is where
 * the engine decides whether it has earned the right to change anything.
 */

import { sampleBeta, seededRng, type Rng } from "../strategy/selector";
import type {
  Arm,
  ArmSummary,
  Experiment,
  Review,
  Trial,
  Verdict,
} from "./types";

/** Weak prior, washed out by a handful of real observations. */
const PRIOR_ALPHA = 1;
const PRIOR_BETA = 1;

/**
 * How far apart the posteriors must be before a difference counts as real.
 * 0.95 = the winner must beat the baseline in 95% of sampled draws. This is
 * the line between "leading" and "won", and it is the single most important
 * constant here: everything that goes wrong with automated optimisation goes
 * wrong by promoting noise.
 */
const CONFIDENCE = 0.95;
const CONFIDENCE_DRAWS = 4000;

export class ExperimentError extends Error {}

/**
 * Choose an arm.
 *
 * A `humanOnly` experiment always returns its baseline: the engine does not
 * get an opinion about pricing, legal copy or security limits, and refusing
 * loudly here rather than silently sampling is what makes that guarantee
 * checkable.
 */
export function decide<T>(
  experiment: Experiment<T>,
  trials: readonly Trial[],
  options: { rng?: Rng; deterministic?: boolean } = {},
): Arm<T> {
  if (experiment.arms.length === 0) throw new ExperimentError("experiment has no arms");
  const baseline = experiment.arms.find((a) => a.baseline) ?? experiment.arms[0];
  if (experiment.humanOnly) return baseline;

  const summaries = summarise(experiment, trials);
  const rng = options.rng ?? Math.random;

  let best = experiment.arms[0];
  let bestScore = -Infinity;
  for (const arm of experiment.arms) {
    const s = summaries.find((x) => x.armId === arm.id)!;
    const score = options.deterministic
      ? s.alpha / (s.alpha + s.beta)
      : sampleBeta(rng, s.alpha, s.beta);
    if (score > bestScore) {
      bestScore = score;
      best = arm;
    }
  }
  return best;
}

/** Aggregate trials into one posterior per arm. Arms with no data still appear. */
export function summarise<T>(
  experiment: Experiment<T>,
  trials: readonly Trial[],
): ArmSummary[] {
  return experiment.arms.map((arm) => {
    const mine = trials.filter((t) => t.experimentId === experiment.id && t.armId === arm.id);
    const conversions = mine.filter((t) => t.converted).length;
    const total = mine.reduce((sum, t) => sum + (Number.isFinite(t.value) ? t.value : 0), 0);
    return {
      armId: arm.id,
      samples: mine.length,
      conversions,
      meanValue: mine.length ? total / mine.length : 0,
      alpha: PRIOR_ALPHA + conversions,
      beta: PRIOR_BETA + (mine.length - conversions),
    };
  });
}

/**
 * Probability that `a` really is better than `b`, by sampling both posteriors.
 * Exact for Beta pairs would be a closed form; sampling is clearer, fast
 * enough at these sizes, and reproducible from the seed.
 */
function probabilityBetter(a: ArmSummary, b: ArmSummary, rng: Rng): number {
  let wins = 0;
  for (let i = 0; i < CONFIDENCE_DRAWS; i++) {
    if (sampleBeta(rng, a.alpha, a.beta) > sampleBeta(rng, b.alpha, b.beta)) wins++;
  }
  return wins / CONFIDENCE_DRAWS;
}

/** Mean of a guardrail metric for one arm. */
function guardrailMean(trials: readonly Trial[], experimentId: string, armId: string, key: string) {
  const values = trials
    .filter((t) => t.experimentId === experimentId && t.armId === armId)
    .map((t) => t.guardrailValues?.[key])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Decide whether the engine has earned the right to change the product.
 *
 * The order of the checks is the safety argument, so it is worth stating:
 * refuse what must never be automated, then require enough data, then require
 * the guardrails to hold, then require the effect to be both real and big
 * enough to be worth having. A guardrail checked after promotion is not a
 * guardrail.
 */
export function review<T>(
  experiment: Experiment<T>,
  trials: readonly Trial[],
  options: { rng?: Rng } = {},
): Review {
  const arms = summarise(experiment, trials);
  const baselineArm = experiment.arms.find((a) => a.baseline);
  const baselineArmId = baselineArm?.id ?? null;
  const rng = options.rng ?? seededRng(1);

  const done = (verdict: Verdict, explanation: string): Review => ({
    experimentId: experiment.id,
    verdict,
    arms,
    baselineArmId,
    explanation,
  });

  if (experiment.arms.length === 0) {
    return done({ kind: "refused", reason: "no_arms" }, "No arms are defined, so there is nothing to compare.");
  }
  if (experiment.humanOnly) {
    return done(
      { kind: "refused", reason: "human_only" },
      "This decision is marked human-only — pricing, legal, consent and security are never changed automatically.",
    );
  }
  if (!baselineArm) {
    return done(
      { kind: "refused", reason: "no_baseline" },
      "No arm is marked as the baseline, so a promotion would have nothing to roll back to.",
    );
  }

  const havePerArm = Object.fromEntries(arms.map((a) => [a.armId, a.samples]));
  if (arms.some((a) => a.samples < experiment.minSamplesPerArm)) {
    return done(
      { kind: "insufficient_data", needPerArm: experiment.minSamplesPerArm, havePerArm },
      `Still collecting: every option needs at least ${experiment.minSamplesPerArm} observations before anything changes.`,
    );
  }

  const baseline = arms.find((a) => a.armId === baselineArm.id)!;
  const baselineRate = baseline.alpha / (baseline.alpha + baseline.beta);

  // Best challenger by posterior mean; ties broken by id so the result is stable.
  const challengers = arms
    .filter((a) => a.armId !== baseline.armId)
    .sort((a, b) => {
      const ra = a.alpha / (a.alpha + a.beta);
      const rb = b.alpha / (b.alpha + b.beta);
      return rb - ra || a.armId.localeCompare(b.armId);
    });
  const challenger = challengers[0];
  if (!challenger) {
    return done({ kind: "no_winner", reason: "within_noise" }, "Only the baseline is running, so there is nothing to promote.");
  }

  const challengerRate = challenger.alpha / (challenger.alpha + challenger.beta);
  const relativeLift = baselineRate > 0 ? (challengerRate - baselineRate) / baselineRate : 0;

  // Guardrails before anything else about the target. A change that wins on
  // the target while damaging trust is not a win, and must not be tradeable.
  for (const guard of experiment.guardrails) {
    const base = guardrailMean(trials, experiment.id, baseline.armId, guard.metric.key);
    const cand = guardrailMean(trials, experiment.id, challenger.armId, guard.metric.key);
    if (base === null || cand === null || base === 0) continue;

    // "Worse" depends on the metric's direction.
    const drop = guard.metric.lowerIsBetter ? (cand - base) / base : (base - cand) / base;
    if (drop > guard.maxRelativeDrop) {
      return done(
        {
          kind: "guardrail_veto",
          armId: challenger.armId,
          metric: guard.metric.key,
          observedDrop: drop,
          allowed: guard.maxRelativeDrop,
        },
        `"${challenger.armId}" improved ${experiment.target.key} but moved ${guard.metric.key} against us by ${(drop * 100).toFixed(1)}%, past the ${(guard.maxRelativeDrop * 100).toFixed(1)}% limit. Rejected rather than traded off.`,
      );
    }
  }

  if (relativeLift < experiment.minRelativeLift) {
    return done(
      { kind: "no_winner", reason: "below_min_lift" },
      `"${challenger.armId}" is ahead by ${(relativeLift * 100).toFixed(1)}%, under the ${(experiment.minRelativeLift * 100).toFixed(1)}% worth changing for. Keeping the current behaviour.`,
    );
  }

  const confidence = probabilityBetter(challenger, baseline, rng);
  if (confidence < CONFIDENCE) {
    return done(
      { kind: "no_winner", reason: "within_noise" },
      `"${challenger.armId}" is leading but only ${(confidence * 100).toFixed(0)}% likely to be genuinely better. Below the ${(CONFIDENCE * 100).toFixed(0)}% bar — leading is not the same as winning.`,
    );
  }

  return done(
    { kind: "promote", armId: challenger.armId, relativeLift, samples: challenger.samples },
    `Adopting "${challenger.armId}": ${(relativeLift * 100).toFixed(1)}% better on ${experiment.target.key} over ${challenger.samples} observations, ${(confidence * 100).toFixed(0)}% likely to be real, no guardrail affected.`,
  );
}

/**
 * The weekly digest — what the system changed about itself, in plain language.
 *
 * Not decoration. A system that rewrites the product without producing a
 * readable account of what it did is one nobody can supervise, and the first
 * time it does something surprising it gets switched off entirely. The report
 * is what buys it the freedom to keep running.
 */
export function digest(reviews: readonly Review[]): string[] {
  const order: Record<Verdict["kind"], number> = {
    promote: 0,
    guardrail_veto: 1,
    no_winner: 2,
    insufficient_data: 3,
    refused: 4,
  };
  return [...reviews]
    .sort((a, b) => order[a.verdict.kind] - order[b.verdict.kind])
    .map((r) => `[${r.verdict.kind}] ${r.experimentId}: ${r.explanation}`);
}
