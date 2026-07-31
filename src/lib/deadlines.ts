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
