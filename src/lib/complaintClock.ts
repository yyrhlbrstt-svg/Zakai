/**
 * The escalation clock — how long a complaint has been sitting, and whether
 * the documented waiting period for its regulator has passed.
 *
 * Nobody carries these dates in their head. A person complains, hears
 * nothing, and has no idea whether they are entitled to escalate today or
 * whether it is "too early" — so most simply never escalate, which is the
 * outcome the company benefits from. The clock removes the guesswork.
 *
 * HONESTY RULE, and it is the whole design: a waiting period is shown ONLY
 * where this repo already carries a sourced figure for it. Banking has one —
 * the Bank of Israel's Banking Supervision unit documents 45 days without a
 * satisfactory reply (60 with a notified extension), which complaintEscalation
 * .ts already cites. Telecom and general consumer complaints have no verified
 * waiting period encoded here, so none is displayed and none is invented:
 * those escalate whenever the person judges the answer inadequate, which is
 * the true position, not a softer one.
 */

import type { ComplaintCategory } from "./complaintEscalation";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Verified waiting periods, per regulator. Absent = no encoded period. */
export const DOCUMENTED_WAIT_DAYS: Partial<Record<ComplaintCategory, number>> = {
  // Bank of Israel, Banking Supervision — Public Inquiries unit.
  bank: 45,
};

/** With a notified extension, the same source gives 60 days. */
export const BANK_EXTENDED_WAIT_DAYS = 60;

export interface ComplaintClock {
  daysElapsed: number;
  /** Null when no verified waiting period exists for this category. */
  waitDays: number | null;
  /** True only when a waitDays exists AND it has passed. */
  waitPassed: boolean;
  /** Days still to wait; 0 when passed or when there is no encoded period. */
  daysRemaining: number;
}

/**
 * Parses the DD/MM/YYYY the tool asks for. Returns null on anything it cannot
 * read rather than guessing a date — a clock started from a misread date is
 * worse than no clock.
 */
export function parseComplaintDate(input: string): Date | null {
  const m = input.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  const year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function computeComplaintClock(
  category: ComplaintCategory,
  sentAt: Date,
  now: Date = new Date(),
): ComplaintClock | null {
  if (Number.isNaN(sentAt.getTime())) return null;
  const elapsedMs = now.getTime() - sentAt.getTime();
  // A complaint dated in the future is a typo, not a clock.
  if (elapsedMs < 0) return null;
  const daysElapsed = Math.floor(elapsedMs / MS_PER_DAY);
  const waitDays = DOCUMENTED_WAIT_DAYS[category] ?? null;
  const waitPassed = waitDays !== null && daysElapsed >= waitDays;
  return {
    daysElapsed,
    waitDays,
    waitPassed,
    daysRemaining: waitDays === null || waitPassed ? 0 : waitDays - daysElapsed,
  };
}
