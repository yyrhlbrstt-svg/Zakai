/**
 * Layer 0 — the reasoning core, in the skeleton form the plan asks for.
 *
 * Pure and model-free on purpose. Every engine routes THROUGH here instead of
 * inventing its own model-calling logic, and the parts worth getting right —
 * how a task is classified, how candidate answers are checked against
 * recorded reality, how confidence is composed — are decisions, not prompts.
 * Keeping them as pure functions means they can be tested, argued with, and
 * changed without a model in the loop.
 *
 * The one idea this file exists to encode: AGREEMENT WITH REALITY BEATS
 * AGREEMENT WITH OTHER MODELS. Three models that agree with each other and
 * contradict two hundred recorded outcomes are three models that are wrong
 * together. `groundedRank` scores every candidate against the evidence first
 * and treats consensus as a tiebreak, never as the signal.
 */

export type TaskStakes = "routine" | "high_stakes";

/**
 * What a task is worth spending on. Drafting a standard letter is routine;
 * anything whose output an institution or a court might act on is not.
 */
export function classifyStakes(kind: string): TaskStakes {
  const highStakes = [
    "predict_institution",
    "score_novel_claim",
    "institutional_risk_number",
    "contagion_forecast",
    "exposure_simulation",
  ];
  return highStakes.includes(kind) ? "high_stakes" : "routine";
}

export interface Candidate<T> {
  /** Which model family produced it — used only for the consensus tiebreak. */
  source: string;
  value: T;
  /** The model's own stated certainty, 0–1. Deliberately not trusted much. */
  selfReported?: number;
}

export interface GroundedScore<T> {
  candidate: Candidate<T>;
  /** How well this answer matches recorded outcomes, 0–1. */
  groundedness: number;
  /** How many other candidates said the same thing, 0–1. */
  consensus: number;
  /** Final rank score. Groundedness dominates by construction. */
  score: number;
}

/**
 * Rank candidate answers against evidence.
 *
 * `agreesWithEvidence` is supplied by the caller because only the caller
 * knows what its evidence means — Engine 1 compares a predicted settle rate
 * against recorded ones, a letter checker would compare cited sections
 * against the rights graph. What this function fixes is the WEIGHTING, so no
 * engine gets to quietly decide that consensus is good enough.
 */
export function groundedRank<T>(
  candidates: readonly Candidate<T>[],
  agreesWithEvidence: (value: T) => number,
  sameAnswer: (a: T, b: T) => boolean = (a, b) => a === b,
): GroundedScore<T>[] {
  if (candidates.length === 0) return [];

  return candidates
    .map((candidate) => {
      const groundedness = clamp01(agreesWithEvidence(candidate.value));
      const agreeing = candidates.filter(
        (other) => other !== candidate && sameAnswer(other.value, candidate.value),
      ).length;
      const consensus =
        candidates.length > 1 ? agreeing / (candidates.length - 1) : 0;
      return {
        candidate,
        groundedness,
        consensus,
        /*
          0.8 / 0.2 is not a tuning knob to be quietly rebalanced later. A
          well-grounded answer that stands alone must outrank a unanimous one
          that the data contradicts, and at these weights it always does:
          the most a lonely-but-right answer can lose on consensus (0.2) is
          less than the least it can win on groundedness against an answer
          reality disagrees with.
        */
        score: Number((0.8 * groundedness + 0.2 * consensus).toFixed(4)),
      };
    })
    .sort((a, b) => b.score - a.score || b.groundedness - a.groundedness);
}

export interface ConfidenceInput {
  /** Share of models that agreed with the chosen answer, 0–1. */
  crossModelAgreement: number;
  /** Historical rows behind this cell. */
  volume: number;
  /** Days since the newest row; null when there is none. */
  newestDaysAgo: number | null;
}

export const VOLUME_SATURATION = 40;
export const RECENCY_HORIZON_DAYS = 540;

/**
 * The three-component score the plan specifies. Engine 1 uses a two-component
 * version because it has no model in its path and says so; this is the
 * version for paths that do, and the components stay separate in the result
 * so a low number can always be explained rather than merely reported.
 */
export function scoreConfidence(input: ConfidenceInput): {
  confidence: number;
  parts: { agreement: number; volume: number; recency: number };
} {
  const agreement = clamp01(input.crossModelAgreement);
  const volume = clamp01(input.volume / VOLUME_SATURATION);
  const recency =
    input.newestDaysAgo === null
      ? 0
      : clamp01(1 - input.newestDaysAgo / RECENCY_HORIZON_DAYS);
  return {
    // Volume leads because it is the component that cannot be manufactured:
    // three models agreeing about two cases is still two cases.
    confidence: Number((0.45 * volume + 0.3 * agreement + 0.25 * recency).toFixed(3)),
    parts: {
      agreement: Number(agreement.toFixed(3)),
      volume: Number(volume.toFixed(3)),
      recency: Number(recency.toFixed(3)),
    },
  };
}

/** Below this, an answer is flagged rather than presented as a finding. */
export const LOW_CONFIDENCE_THRESHOLD = 0.35;

export function isLowConfidence(confidence: number): boolean {
  return confidence < LOW_CONFIDENCE_THRESHOLD;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
