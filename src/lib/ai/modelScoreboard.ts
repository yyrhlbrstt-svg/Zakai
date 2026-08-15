import { isAttributed, parseDrafterId, UNKNOWN_DRAFTER } from "./drafterId";

/**
 * Which drafting model actually gets paid, from closed cases only.
 *
 * This is the aggregate the `drafterId` column exists to make possible: swap
 * the drafting model and this says, some weeks later, whether it was worth it.
 * Nothing else in the product can answer that today.
 *
 * WHAT THIS DELIBERATELY REFUSES TO DO
 *
 * It does not pick a winner from thin evidence. Two models separated by one
 * paid case out of six are not distinguishable, and a scoreboard that declares
 * a winner there would send a real model change into production on noise. So
 * every row carries its sample size, rows under MIN_SAMPLE are reported as
 * "not enough evidence" rather than dropped or rounded up, and `bestDrafter`
 * returns null unless a comparison is actually supportable.
 *
 * It also never mixes self-reported outcomes into the same number as observed
 * ones, for the reason the `selfReported` column exists at all: one has a
 * provider reply behind it, the other has somebody's memory. Callers choose.
 */

/** Same gate, and the same reasoning, as companyScore.ts. */
export const MIN_SAMPLE = 5;

/**
 * How much better one model must score before it is called better. Two models
 * inside this band are reported as a tie, because a 2-point gap on a few dozen
 * cases is noise and acting on it would be superstition, not learning.
 */
export const MEANINGFUL_GAP = 0.05;

export interface OutcomeRow {
  drafterId: string;
  paid: boolean;
  recoveredMinor: number;
  days: number;
  selfReported: boolean;
}

export interface DrafterStats {
  drafterId: string;
  provider: string | null;
  model: string | null;
  /** Total closed cases attributed to this drafter. */
  trials: number;
  paidCount: number;
  /** paidCount / trials, or null below MIN_SAMPLE — never a rounded-up guess. */
  paidRate: number | null;
  /** Total recovered, in minor units. Integer, never a float. */
  recoveredMinor: number;
  /** Median days to resolution among paid cases, or null when none. */
  medianDaysToPaid: number | null;
  /** False when trials < MIN_SAMPLE: the row is shown, but must not be ranked. */
  reportable: boolean;
}

export interface Scoreboard {
  drafters: DrafterStats[];
  /** Cases whose drafter was never recorded. Counted, never hidden. */
  unattributed: number;
  totalTrials: number;
}

export function buildScoreboard(
  rows: readonly OutcomeRow[],
  opts: { includeSelfReported?: boolean } = {},
): Scoreboard {
  const includeSelf = opts.includeSelfReported === true;
  const used = rows.filter((r) => includeSelf || !r.selfReported);

  const byDrafter = new Map<string, OutcomeRow[]>();
  let unattributed = 0;

  for (const r of used) {
    const id = r.drafterId || UNKNOWN_DRAFTER;
    if (!isAttributed(id)) {
      unattributed++;
      continue;
    }
    const list = byDrafter.get(id);
    if (list) list.push(r);
    else byDrafter.set(id, [r]);
  }

  const drafters = [...byDrafter.entries()]
    .map(([id, list]) => statsFor(id, list))
    // Most evidence first; a rate from 200 cases outranks one from 6.
    .sort((a, b) => b.trials - a.trials || a.drafterId.localeCompare(b.drafterId));

  return { drafters, unattributed, totalTrials: used.length };
}

function statsFor(id: string, list: readonly OutcomeRow[]): DrafterStats {
  const parsed = parseDrafterId(id);
  const paid = list.filter((r) => r.paid);
  const reportable = list.length >= MIN_SAMPLE;

  return {
    drafterId: id,
    provider: parsed?.provider ?? null,
    model: parsed?.model ?? null,
    trials: list.length,
    paidCount: paid.length,
    paidRate: reportable ? paid.length / list.length : null,
    // Integer minor units throughout — no float ever touches money here.
    recoveredMinor: list.reduce((sum, r) => sum + Math.max(0, Math.round(r.recoveredMinor)), 0),
    medianDaysToPaid: median(paid.map((r) => r.days)),
    reportable,
  };
}

/**
 * The best-supported drafter, or null when the evidence does not support
 * naming one. Null is a real and common answer, and it is the honest one
 * early: with two thin rows there is nothing to choose between.
 */
export function bestDrafter(board: Scoreboard): DrafterStats | null {
  const ranked = board.drafters
    .filter((d) => d.reportable && d.paidRate !== null)
    .sort((a, b) => (b.paidRate ?? 0) - (a.paidRate ?? 0) || b.trials - a.trials);

  if (ranked.length === 0) return null;
  if (ranked.length === 1) return ranked[0];

  const gap = (ranked[0].paidRate ?? 0) - (ranked[1].paidRate ?? 0);
  return gap >= MEANINGFUL_GAP ? ranked[0] : null;
}

/** True when at least two drafters have enough evidence to be compared. */
export function comparable(board: Scoreboard): boolean {
  return board.drafters.filter((d) => d.reportable).length >= 2;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
