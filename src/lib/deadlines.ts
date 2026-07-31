/**
 * Personal deadline reminders — a passport renewal, a car test, an annual
 * filing date. No Case, no Mandate, no fee: this is a calendar with a nudge,
 * not a money-recovery vertical.
 *
 * `isReminderDue` deliberately has no upper bound at the due date itself: a
 * deadline the cron missed (an outage, a delayed deploy) should still fire
 * the one reminder it owes rather than silently going quiet once the date
 * has passed — a late reminder is still useful, a missing one is a bug.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_REMIND_DAYS_BEFORE = 14;
export const MAX_REMIND_DAYS_BEFORE = 180;

/**
 * General civil limitation period under the Statute of Limitations Law,
 * 5718-1958 (חוק ההתיישנות, תשי"ח-1958), section 5 — verified once already
 * this session for overtimeBackPay.ts. This is the general default a claim
 * is barred after, not an absolute: real-estate claims run 25 years, some
 * claims against the state or in tort run shorter, and a court can extend
 * the period in specific circumstances (fraud concealment, minority, etc.).
 * Treated here exactly like late-payment's statutory term — a default to
 * warn against, never a substitute for checking the specific claim type.
 */
export const GENERAL_LIMITATION_YEARS = 7;

/**
 * When does a claim that arose on `eventDate` become time-barred under the
 * general 7-year civil default? Returns null for an unparsable date rather
 * than throwing, matching every other date-parsing helper in this app.
 */
export function computeClaimExpiry(eventDate: string): Date | null {
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return null;
  const expiry = new Date(d);
  expiry.setFullYear(expiry.getFullYear() + GENERAL_LIMITATION_YEARS);
  return expiry;
}

export interface DeadlineLike {
  dueDate: Date;
  remindDaysBefore: number;
  notifiedAt: Date | null;
}

/** True exactly once per deadline: inside the reminder window and not yet notified. */
export function isReminderDue(deadline: DeadlineLike, now: Date = new Date()): boolean {
  if (deadline.notifiedAt) return false;
  const windowStart = new Date(deadline.dueDate.getTime() - deadline.remindDaysBefore * MS_PER_DAY);
  return now.getTime() >= windowStart.getTime();
}

/** Whole days from now until the due date — negative once it's passed. */
export function daysUntil(dueDate: Date, now: Date = new Date()): number {
  return Math.ceil((dueDate.getTime() - now.getTime()) / MS_PER_DAY);
}

/** Clamp a user-supplied lead time to a sane range. */
export function normalizeRemindDaysBefore(days: number): number {
  const n = Math.floor(days);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_REMIND_DAYS_BEFORE;
  return Math.min(n, MAX_REMIND_DAYS_BEFORE);
}
