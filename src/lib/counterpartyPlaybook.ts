import { MIN_SAMPLE } from "./companyScore";

/**
 * What actually works against a given company.
 *
 * WHY THIS IS THE THING ANOTHER AGENT CANNOT GET ANYWHERE ELSE
 *
 * A general assistant with access to somebody's bank account can read the
 * statement, spot the fee and draft a better letter than this codebase ever
 * will. What it cannot do — not because it is less capable, but because of
 * how it is built — is know that this company pays on this kind of claim
 * roughly six times in ten, takes about eighteen days, and concedes more
 * often to one phrasing than another. Every conversation it has is isolated
 * from every other by design, so the one thing that only accumulates across
 * many people is permanently out of reach.
 *
 * That is the asymmetry worth building on. Not "we are smarter" — we are not
 * — but "we hold the only record of what happened last time, a thousand times
 * over". An agent that calls this before writing is strictly better off than
 * one that does not, which is the only durable reason for anything to route
 * through us.
 *
 * WHAT IT REFUSES TO SAY
 *
 * Anything below the sample floor. A win rate computed from three cases is an
 * anecdote with a percent sign on it, and this one names a company to a third
 * party who will act on it. Silence is the honest output, and it is returned
 * as an explicit "not enough evidence" rather than a zero that reads like a
 * finding.
 */

/** A minimum gap before one approach is called better than another. */
export const MEANINGFUL_GAP = 0.1;

/** De-identified outcome row — never carries a person. */
export interface OutcomeRow {
  counterparty: string;
  vertical: string;
  variantId: string;
  paid: boolean;
  recoveredMinor: number;
  days: number;
}

export interface VariantRecord {
  variantId: string;
  trials: number;
  paid: number;
  paidRate: number;
}

export interface Playbook {
  counterparty: string;
  vertical: string | null;
  /** Documented outcomes behind every figure here. */
  sampleSize: number;
  paidRate: number;
  /** Median days from delivery to resolution among the ones that paid. */
  medianDays: number | null;
  /** Total recovered across the sample, in minor units. */
  recoveredMinor: number;
  /**
   * The approach that wins most often, when one clearly does. Null when the
   * variants are within noise of each other — reporting a leader then would
   * send every future claim down a path chosen by chance.
   */
  bestVariant: VariantRecord | null;
  variants: VariantRecord[];
}

export type PlaybookResult =
  | { ok: true; playbook: Playbook }
  | { ok: false; reason: "not_enough_evidence"; sampleSize: number; minSample: number };

/**
 * Build the playbook for one counterparty.
 *
 * `rows` must already be documented outcomes only. A self-report is somebody's
 * memory, and this is handed to a third party as guidance about a named
 * company.
 */
export function buildPlaybook(
  counterparty: string,
  rows: readonly OutcomeRow[],
  vertical: string | null = null,
  minSample: number = MIN_SAMPLE,
): PlaybookResult {
  const key = counterparty.trim().toLowerCase();
  const relevant = rows.filter(
    (r) => r.counterparty.trim().toLowerCase() === key && (vertical === null || r.vertical === vertical),
  );

  if (relevant.length < minSample) {
    return {
      ok: false,
      reason: "not_enough_evidence",
      sampleSize: relevant.length,
      minSample,
    };
  }

  const paid = relevant.filter((r) => r.paid);

  const byVariant = new Map<string, { trials: number; paid: number }>();
  for (const r of relevant) {
    const entry = byVariant.get(r.variantId) ?? { trials: 0, paid: 0 };
    entry.trials += 1;
    if (r.paid) entry.paid += 1;
    byVariant.set(r.variantId, entry);
  }

  const variants: VariantRecord[] = [...byVariant.entries()]
    .map(([variantId, v]) => ({
      variantId,
      trials: v.trials,
      paid: v.paid,
      paidRate: v.paid / v.trials,
    }))
    .sort((a, b) => b.paidRate - a.paidRate || b.trials - a.trials);

  return {
    ok: true,
    playbook: {
      counterparty: key,
      vertical,
      sampleSize: relevant.length,
      paidRate: paid.length / relevant.length,
      medianDays: median(paid.map((r) => r.days)),
      recoveredMinor: relevant.reduce((s, r) => s + Math.max(0, Math.round(r.recoveredMinor)), 0),
      bestVariant: pickBest(variants, minSample),
      variants,
    },
  };
}

/**
 * A leader only when it is one.
 *
 * Each candidate needs its own sample — a variant tried twice that happened to
 * win twice is not a strategy — and it must beat the runner-up by more than
 * noise. Otherwise every future claim gets routed down a path chosen by a
 * coin flip and the record then confirms the choice it caused.
 */
function pickBest(variants: readonly VariantRecord[], minSample: number): VariantRecord | null {
  const eligible = variants.filter((v) => v.trials >= minSample);
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0];
  const [first, second] = eligible;
  return first.paidRate - second.paidRate >= MEANINGFUL_GAP ? first : null;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
