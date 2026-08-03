/**
 * Pure aggregations over StrategyOutcome rows → explainable learning hints.
 * Used by the assistant brain and next-action EV ranking. Never invents rows.
 */

import { variantLabel } from "./variants";
import { isCatalogVariantId } from "./normalizeKeys";

export type LearningOutcomeRow = {
  market: string;
  vertical: string;
  counterparty: string;
  variantId: string;
  paid: boolean;
  recoveredMinor: number;
  days: number;
  selfReported?: boolean;
};

export type StanceLearning = {
  variantId: string;
  labelHe: string;
  labelEn: string;
  trials: number;
  wins: number;
  winRate: number;
  avgRecoveredMinor: number;
  /** Human-readable why this stance leads for the cohort. */
  whyHe: string;
  whyEn: string;
};

export type CohortLearning = {
  market: string;
  vertical: string;
  counterparty: string;
  trials: number;
  winRate: number;
  avgRecoveredMinor: number;
  /** Median days among paid resolutions (timing signal). */
  medianDaysToWin: number | null;
  bestStance: StanceLearning | null;
};

const MIN_TRIALS = 5;
const MIN_STANCE_TRIALS = 3;

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[mid - 1]! + s[mid]!) / 2) : s[mid]!;
}

/**
 * Best explainable stance for a (market, vertical, counterparty) cell.
 * Verified rows preferred; self-reports only fill when verified is thin.
 */
export function cohortLearning(
  rows: readonly LearningOutcomeRow[],
  market: string,
  vertical: string,
  counterparty: string,
): CohortLearning | null {
  const cell = rows.filter(
    (r) =>
      r.market === market &&
      r.vertical === vertical &&
      r.counterparty === counterparty &&
      isCatalogVariantId(r.variantId),
  );
  const verified = cell.filter((r) => !r.selfReported);
  const pool = verified.length >= MIN_TRIALS ? verified : cell;
  if (pool.length < MIN_TRIALS) return null;

  const wins = pool.filter((r) => r.paid && r.recoveredMinor > 0);
  const winRate = wins.length / pool.length;
  const avgRecoveredMinor =
    wins.length > 0
      ? Math.round(wins.reduce((s, r) => s + r.recoveredMinor, 0) / wins.length)
      : 0;
  const medianDaysToWin = median(wins.map((r) => r.days));

  const byVariant = new Map<string, { n: number; wins: number; recovered: number }>();
  for (const r of pool) {
    const cur = byVariant.get(r.variantId) ?? { n: 0, wins: 0, recovered: 0 };
    cur.n += 1;
    if (r.paid && r.recoveredMinor > 0) {
      cur.wins += 1;
      cur.recovered += r.recoveredMinor;
    }
    byVariant.set(r.variantId, cur);
  }

  let bestStance: StanceLearning | null = null;
  for (const [variantId, s] of byVariant) {
    if (s.n < MIN_STANCE_TRIALS) continue;
    const rate = s.wins / s.n;
    const avg = s.wins > 0 ? Math.round(s.recovered / s.wins) : 0;
    const ev = rate * avg;
    const labels = variantLabel(variantId);
    const candidate: StanceLearning = {
      variantId,
      labelHe: labels.he,
      labelEn: labels.en,
      trials: s.n,
      wins: s.wins,
      winRate: rate,
      avgRecoveredMinor: avg,
      whyHe: `${labels.he}: ${(rate * 100).toFixed(0)}% הצלחה ב־${s.n} תיקים מתועדים (EV≈₪${Math.round(ev / 100)})`,
      whyEn: `${labels.en}: ${(rate * 100).toFixed(0)}% wins over ${s.n} documented trials (EV≈₪${Math.round(ev / 100)})`,
    };
    if (
      !bestStance ||
      candidate.winRate * candidate.avgRecoveredMinor >
        bestStance.winRate * bestStance.avgRecoveredMinor
    ) {
      bestStance = candidate;
    }
  }

  return {
    market,
    vertical,
    counterparty,
    trials: pool.length,
    winRate,
    avgRecoveredMinor,
    medianDaysToWin,
    bestStance,
  };
}

/**
 * Expected recovery in agorot using documented win rate when available.
 * Cold prior 0.35 keeps ranking useful before volume exists — not a promise.
 */
export function expectedRecoveryAgorot(
  amountOriginal: number,
  targetAmount: number,
  winRate: number | null | undefined,
  coldPrior = 0.35,
): number {
  const delta = Math.max(0, amountOriginal - targetAmount);
  const p = winRate != null && winRate >= 0 ? winRate : coldPrior;
  return Math.round(delta * p);
}

/** Compact lines for the assistant snapshot (one cohort). */
export function formatLearningBrief(
  cohort: CohortLearning,
  locale: "he" | "en" = "he",
): string[] {
  const he = locale === "he";
  const lines: string[] = [
    he
      ? `LEARNING (${cohort.counterparty}/${cohort.vertical}): n=${cohort.trials} win=${(cohort.winRate * 100).toFixed(0)}% avg≈₪${Math.round(cohort.avgRecoveredMinor / 100)}`
      : `LEARNING (${cohort.counterparty}/${cohort.vertical}): n=${cohort.trials} win=${(cohort.winRate * 100).toFixed(0)}% avg≈₪${Math.round(cohort.avgRecoveredMinor / 100)}`,
  ];
  if (cohort.bestStance) {
    lines.push(
      he
        ? `BEST_STANCE: ${cohort.bestStance.variantId} — ${cohort.bestStance.whyHe}`
        : `BEST_STANCE: ${cohort.bestStance.variantId} — ${cohort.bestStance.whyEn}`,
    );
  }
  if (cohort.medianDaysToWin != null) {
    lines.push(
      he
        ? `TIMING: חציון ימים עד חיסכון מתועד = ${cohort.medianDaysToWin}. עקוב בכתב; אל תסלים בטלפון.`
        : `TIMING: median days to documented win = ${cohort.medianDaysToWin}. Follow up in writing; never escalate by phone.`,
    );
  }
  return lines;
}
