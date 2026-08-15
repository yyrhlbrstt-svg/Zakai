/**
 * The date you must act by — not the date the contract renews.
 *
 * THE PROBLEM THIS SOLVES, WHICH NOBODY SOLVES
 *
 * A contract renews on 1 January and requires sixty days' written notice. The
 * date that matters is therefore 1 November, and it appears nowhere: not in
 * the contract's headline, not in a calendar, not in any reminder anyone
 * sets. It has to be derived from two numbers buried in a PDF nobody reads
 * after signing.
 *
 * Miss it by a day and the term rolls for another year at a price nobody
 * agreed to now. That is the single most expensive routine mistake in
 * commercial life, it is made by individuals and by finance departments
 * alike, and there is no product that watches for it — because doing so
 * requires reading the contract, not the invoice.
 *
 * `ContractAnalysis` already extracts whether a contract auto-renews and when.
 * It never extracted the notice period, so the product could say "this renews
 * on 1 January" — the date that is already too late to be useful.
 *
 * WHAT IT REFUSES TO DO
 *
 * Everything here is derived from figures found in the document. A missing
 * notice period yields no deadline rather than a default guess, because a
 * confidently wrong "act by" date is worse than none: someone relaxes, and
 * the term rolls. Being unable to say is a real answer and it is said.
 */

const DAY_MS = 86_400_000;

export type WindowState =
  | "open" // still time to give notice
  | "closing" // inside the urgency threshold
  | "missed" // the notice window has passed; it will renew
  | "unknown"; // not enough was found in the document to say

export interface NoticeWindow {
  /** Renewal date as found in the contract. */
  renewsOn: Date | null;
  /** Days of written notice the contract requires. */
  noticeDays: number | null;
  /** Last day notice can be given. Null when either input is missing. */
  actBy: Date | null;
  /** Whole days from `now` until `actBy`. Negative once passed. */
  daysLeft: number | null;
  state: WindowState;
}

/**
 * Inside this many days, the deadline stops being a diary entry and becomes
 * something to do today. Written notice usually has to be prepared, signed
 * and delivered, and a week is the least that reliably allows for that.
 */
export const CLOSING_SOON_DAYS = 14;

export function computeNoticeWindow(input: {
  renewalDate: string | null;
  noticeDays: number | null;
  now?: Date;
}): NoticeWindow {
  const now = input.now ?? new Date();
  const renewsOn = parseIsoDate(input.renewalDate);
  const noticeDays =
    typeof input.noticeDays === "number" && Number.isFinite(input.noticeDays) && input.noticeDays >= 0
      ? Math.round(input.noticeDays)
      : null;

  if (!renewsOn || noticeDays === null) {
    // Both numbers are needed and neither is guessable. Saying so beats
    // inventing a date somebody will plan around.
    return { renewsOn, noticeDays, actBy: null, daysLeft: null, state: "unknown" };
  }

  const actBy = new Date(renewsOn.getTime() - noticeDays * DAY_MS);
  const daysLeft = Math.round((midnight(actBy).getTime() - midnight(now).getTime()) / DAY_MS);

  return {
    renewsOn,
    noticeDays,
    actBy,
    daysLeft,
    state: daysLeft < 0 ? "missed" : daysLeft <= CLOSING_SOON_DAYS ? "closing" : "open",
  };
}

/**
 * Windows that need action now, soonest first.
 *
 * "missed" is deliberately included. A passed deadline is not noise to filter
 * out — it is the most important thing on the list, because the person still
 * has to decide what to do about a term that is now rolling.
 */
export function needsAttention<T extends { window: NoticeWindow }>(items: readonly T[]): T[] {
  return items
    .filter((i) => i.window.state === "closing" || i.window.state === "missed")
    .sort((a, b) => (a.window.daysLeft ?? 0) - (b.window.daysLeft ?? 0));
}

/** Total annual value at risk across windows that have not yet been missed. */
export function atRiskAnnualAgorot(
  items: readonly { window: NoticeWindow; monthlyAgorot: number }[],
): number {
  return items
    .filter((i) => i.window.state === "open" || i.window.state === "closing")
    .reduce((sum, i) => sum + Math.max(0, Math.round(i.monthlyAgorot)) * 12, 0);
}

function parseIsoDate(v: string | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
