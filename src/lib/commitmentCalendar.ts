import { estimateNextCharge, type NextChargeEstimate } from "./nextCharge";
import type { RecurringCharge } from "./subscriptions";

/**
 * What is about to leave your account, and when.
 *
 * THE GAP THIS CLOSES
 *
 * Every banking app shows the past: what was charged, sorted by date
 * descending. None of them shows the thing people actually worry about — the
 * money already committed for the weeks ahead. "Will there be enough on the
 * 14th" is answered by memory, and memory is why a forgotten subscription
 * survives for two years.
 *
 * The scan already finds recurring charges, and `estimateNextCharge` already
 * knows when each one lands. Nothing had ever put the two together into the
 * one view a person would open every month.
 *
 * This is not a new tool competing with the others; it is the forward half of
 * the scan that already exists. And it is the moment cancelling is worth
 * something: a charge you stop before it lands costs nothing to recover.
 *
 * WHAT IT REFUSES TO DO
 *
 * It never invents a date. A charge whose cadence is unclear is reported as
 * undated rather than being placed on a guessed day, because a calendar people
 * plan against is worthless the first time it is confidently wrong. Undated
 * charges are still counted in a separate total, so the headline number is
 * never quietly understated either.
 */

export interface CommitmentEntry {
  merchant: string;
  monthlyAgorot: number;
  /** Null when the cadence was too unclear to date honestly. */
  next: NextChargeEstimate | null;
}

export interface CommitmentWindow {
  /** How many days ahead this covers. */
  days: number;
  /** Charges expected to land inside the window, soonest first. */
  dated: CommitmentEntry[];
  /**
   * Recurring charges we could not date. Counted separately so the headline
   * is honest about what it does and does not include.
   */
  undated: CommitmentEntry[];
  /** Sum of the dated charges, in agorot. The number people came for. */
  datedAgorot: number;
  /** Sum of the undated ones, in agorot. */
  undatedAgorot: number;
  /** The soonest charge in the window, or null if none. */
  nextUp: CommitmentEntry | null;
}

/** A month ahead is the horizon most people budget against. */
export const DEFAULT_WINDOW_DAYS = 30;

export function buildCommitmentWindow(
  charges: readonly RecurringCharge[],
  opts: { days?: number; now?: Date } = {},
): CommitmentWindow {
  const days = opts.days ?? DEFAULT_WINDOW_DAYS;
  const now = opts.now ?? new Date();

  const entries: CommitmentEntry[] = charges.map((c) => ({
    merchant: c.merchant,
    monthlyAgorot: Math.max(0, Math.round(c.monthlyAgorot)),
    next: estimateNextCharge(c.chargedOn, now),
  }));

  const dated = entries
    .filter((e) => e.next !== null && e.next.daysUntil >= 0 && e.next.daysUntil <= days)
    .sort((a, b) => (a.next?.daysUntil ?? 0) - (b.next?.daysUntil ?? 0));

  // Anything recurring that we could not place on a day. Deliberately not
  // dropped: a headline that silently omits them understates the commitment.
  const undated = entries.filter((e) => e.next === null);

  const sum = (list: readonly CommitmentEntry[]) =>
    list.reduce((t, e) => t + e.monthlyAgorot, 0);

  return {
    days,
    dated,
    undated,
    datedAgorot: sum(dated),
    undatedAgorot: sum(undated),
    nextUp: dated[0] ?? null,
  };
}

/**
 * Charges landing within `withinDays` — the ones where cancelling still beats
 * asking for a refund afterwards.
 */
export function actNowBefore(
  window: CommitmentWindow,
  withinDays = 7,
): CommitmentEntry[] {
  return window.dated.filter((e) => (e.next?.daysUntil ?? Infinity) <= withinDays);
}

/**
 * Group the window by day, for rendering a calendar strip.
 *
 * Days with nothing due are omitted rather than emitted as empty rows: a
 * calendar of mostly blanks buries the four dates that matter.
 */
export function byDay(window: CommitmentWindow): { daysUntil: number; entries: CommitmentEntry[] }[] {
  const map = new Map<number, CommitmentEntry[]>();
  for (const e of window.dated) {
    const d = e.next!.daysUntil;
    const list = map.get(d);
    if (list) list.push(e);
    else map.set(d, [e]);
  }
  return [...map.entries()]
    .map(([daysUntil, entries]) => ({ daysUntil, entries }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * True when the window is worth showing at all. An empty calendar is not a
 * feature — it is a panel that makes the product look like it did nothing.
 */
export function worthShowing(window: CommitmentWindow): boolean {
  return window.dated.length > 0;
}
