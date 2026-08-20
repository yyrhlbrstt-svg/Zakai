/**
 * Statute concentration — Master Build Prompt v2, constraint 12.
 *
 * A rights rail whose entire active volume rides one statute has a single
 * point of legal failure: one amendment, one adverse ruling, one regulator
 * reading, and the book stops. The constraint is that no single statute may
 * exceed a configured share of active case volume — and constraints that are
 * not computed are opinions, so this module computes it (the autopilot job
 * feeds it live counts nightly and alerts on breach).
 *
 * Honesty rules:
 *  - Shares are computed over MAPPED cases only (verticals that invoke a
 *    graph right), and the unmapped remainder is reported as a number, never
 *    folded in — folding it in would fake diversification with cases that
 *    cite no statute at all.
 *  - Below a minimum sample, breaches are not alerted (three cases, all
 *    subscription, is 100% concentration and zero information) — but the
 *    shares are still reported, flagged `belowSample`.
 *
 * Pure and client-safe; the DB stays in the job.
 */

import { getRight, rightIdForVertical } from "./registry";

/** Default ceiling: no statute may carry more than half the mapped book. */
export const DEFAULT_MAX_STATUTE_SHARE = 0.5;

/** Below this many mapped active cases, concentration is reported, not alerted. */
export const DEFAULT_MIN_CASES_FOR_ALERT = 10;

export interface VerticalCount {
  vertical: string;
  count: number;
}

export interface StatuteShare {
  rightId: string;
  /** From the graph entry, for a report a human can read without a lookup. */
  statuteName: string;
  statuteSection: string;
  count: number;
  /** Fraction of MAPPED active cases (0..1). */
  share: number;
}

export interface ConcentrationReport {
  totalMapped: number;
  totalUnmapped: number;
  maxShare: number;
  minCasesForAlert: number;
  /** True when totalMapped < minCasesForAlert — shares shown, alerts suppressed. */
  belowSample: boolean;
  shares: StatuteShare[];
  /** Shares over the ceiling — empty while belowSample. */
  breaches: StatuteShare[];
}

export function computeStatuteConcentration(
  counts: readonly VerticalCount[],
  opts: { maxShare?: number; minCasesForAlert?: number } = {},
): ConcentrationReport {
  const maxShare = opts.maxShare ?? DEFAULT_MAX_STATUTE_SHARE;
  const minCasesForAlert = opts.minCasesForAlert ?? DEFAULT_MIN_CASES_FOR_ALERT;

  const byRight = new Map<string, number>();
  let totalUnmapped = 0;
  for (const { vertical, count } of counts) {
    if (count <= 0) continue;
    const rightId = rightIdForVertical(vertical);
    if (!rightId) {
      totalUnmapped += count;
      continue;
    }
    byRight.set(rightId, (byRight.get(rightId) ?? 0) + count);
  }

  const totalMapped = [...byRight.values()].reduce((a, b) => a + b, 0);
  const shares: StatuteShare[] = [...byRight.entries()]
    .map(([rightId, count]) => {
      const right = getRight(rightId);
      return {
        rightId,
        statuteName: right?.statute.name ?? "unknown",
        statuteSection: right?.statute.section ?? "unknown",
        count,
        share: totalMapped > 0 ? count / totalMapped : 0,
      };
    })
    .sort((a, b) => b.count - a.count);

  const belowSample = totalMapped < minCasesForAlert;
  const breaches = belowSample ? [] : shares.filter((s) => s.share > maxShare);

  return {
    totalMapped,
    totalUnmapped,
    maxShare,
    minCasesForAlert,
    belowSample,
    shares,
    breaches,
  };
}
