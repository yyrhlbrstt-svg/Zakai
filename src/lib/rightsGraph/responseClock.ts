/**
 * Response clock — Master Build Prompt v2, Phase 2: deadline clocks.
 *
 * Every graphed right names a response window (`procedure.responseDeadlineDays`)
 * and an escalation ladder, but until this module nothing computed "the window
 * on this demand closed on date X — the next rung is due". Deadlines that are
 * not computed are vibes; a provider learns quickly which senders track their
 * own clocks.
 *
 * Pure and client-safe. Calendar days, exactly as the graph encodes them —
 * a right whose statute counts business days encodes that in its own
 * deadlineDays value, not here.
 *
 * Honesty rules:
 *  - The clock starts at a demand that was actually SENT — callers must pass
 *    the dispatch time of a real send, never a QUEUED row's creation time.
 *  - Only verified rights get clocks: a draft right must not drive a user
 *    toward escalation any more than it may reach a letter.
 *  - The "next rung" is a suggestion derived from how many written demands
 *    went out; it never claims a rung already happened (we cannot know a
 *    regulator complaint was filed outside the system).
 */

import { getRight, rightIdForVertical } from "./registry";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Hebrew labels for ladder rungs, for surfaces that render the clock. */
export const ESCALATION_RUNG_HE: Record<string, string> = {
  followup_continued_billing: "מכתב מעקב — חיוב שנמשך לאחר ביטול",
  regulator_complaint: "תלונה לגורם המפקח",
  small_claims_package: "הכנת תיק לתביעה קטנה",
  counsel_handoff: "העברה לייעוץ משפטי",
};

export interface ResponseClockInput {
  vertical: string;
  /** Dispatch time of the LAST demand actually SENT (never a QUEUED row). */
  lastDemandSentAt: Date;
  /** How many written demands were actually SENT on this case. */
  demandsSent: number;
  now?: Date;
}

export interface ResponseClock {
  rightId: string;
  deadlineDays: number;
  /** When the response window on the last sent demand closes/closed. */
  expiresAt: Date;
  expired: boolean;
  /** Whole days: positive daysOverdue XOR positive daysRemaining, never both. */
  daysRemaining: number;
  daysOverdue: number;
  /** The suggested next rung id from the right's ladder, with label. */
  nextRung: string;
  nextRungLabelHe: string;
  /** The rungs still ahead (nextRung first) — never claims any already happened. */
  remainingLadder: string[];
}

export function computeResponseClock(input: ResponseClockInput): ResponseClock | null {
  const rightId = rightIdForVertical(input.vertical);
  if (!rightId) return null;
  const right = getRight(rightId);
  if (!right || right.status !== "verified") return null;
  if (!(input.lastDemandSentAt instanceof Date) || Number.isNaN(input.lastDemandSentAt.getTime()))
    return null;
  if (!Number.isFinite(input.demandsSent) || input.demandsSent < 1) return null;

  const now = input.now ?? new Date();
  const deadlineDays = right.procedure.responseDeadlineDays;
  const expiresAt = new Date(input.lastDemandSentAt.getTime() + deadlineDays * MS_PER_DAY);
  const expired = now.getTime() >= expiresAt.getTime();
  const diffDays = Math.ceil(Math.abs(expiresAt.getTime() - now.getTime()) / MS_PER_DAY);

  // One demand sent → the ladder's first rung is next; two or more → the
  // written route has been tried twice, the next rung is the second. Clamped:
  // the ladder's last rung stays "next" however many demands went out.
  const rungIndex = Math.min(input.demandsSent <= 1 ? 0 : 1, right.escalation.length - 1);
  const remainingLadder = right.escalation.slice(rungIndex);
  const nextRung = remainingLadder[0];

  return {
    rightId,
    deadlineDays,
    expiresAt,
    expired,
    daysRemaining: expired ? 0 : diffDays,
    daysOverdue: expired ? diffDays : 0,
    nextRung,
    nextRungLabelHe: ESCALATION_RUNG_HE[nextRung] ?? nextRung,
    remainingLadder: [...remainingLadder],
  };
}
