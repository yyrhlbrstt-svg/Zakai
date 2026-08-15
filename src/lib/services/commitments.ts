import "server-only";
import { prisma } from "@/lib/prisma";
import { shekelsToAgorot } from "@/lib/money";
import { computeNoticeWindow, needsAttention, type NoticeWindow } from "@/lib/noticeWindow";
import { findOverlaps, type ServiceOverlap } from "@/lib/overlappingServices";
import type { ChargeCategory, RecurringCharge } from "@/lib/subscriptions";
import { isProviderKey } from "@/lib/providers";

/**
 * What a person is committed to, and until when they can still get out.
 *
 * WHY THIS IS THE RECORD
 *
 * A Case exists because somebody suspected, on a particular day, that they
 * were owed money. That makes the product somewhere you go when you remember
 * to — and remembering to check whether you are owed money is the least
 * memorable errand there is.
 *
 * Obligations are the opposite. Everybody has a set of them, the set changes
 * every month whether or not anyone is looking, and it lives nowhere: the bank
 * app holds the charge, the inbox holds the contract, the drawer holds the
 * paper, and nothing at all holds "what am I committed to, and until when can
 * I leave". Holding that set is continuous by nature.
 *
 * Every engine already written here is a function over this set rather than a
 * feature beside it: the notice window says when a term can still be stopped,
 * the overlap finder says where two vendors are paid for one job, and the
 * calendar says what is about to be charged. This module is the set.
 */

export class CommitmentError extends Error {
  constructor(readonly code: "NOT_FOUND" | "INVALID") {
    super(code);
    this.name = "CommitmentError";
  }
}

export interface CommitmentInput {
  label: string;
  counterparty?: string;
  category?: ChargeCategory;
  /** Recurring cost. Omitted when the person does not know it yet. */
  monthlyShekels?: number | null;
  renewsOn?: Date | null;
  noticeDays?: number | null;
  source?: "contract_scan" | "statement_scan" | "manual";
}

export interface CommitmentView {
  id: string;
  label: string;
  counterparty: string;
  category: ChargeCategory;
  monthlyMinor: number | null;
  renewsOn: Date | null;
  noticeDays: number | null;
  source: string;
  /** The deadline to act by, derived — never stored, so it cannot go stale. */
  window: NoticeWindow;
}

function toView(row: {
  id: string;
  label: string;
  counterparty: string;
  category: string;
  monthlyMinor: number | null;
  renewsOn: Date | null;
  noticeDays: number | null;
  source: string;
}, now: Date): CommitmentView {
  return {
    ...row,
    category: row.category as ChargeCategory,
    // Derived on every read rather than persisted: a stored "act by" date is
    // wrong the moment either input is corrected, and nothing would say so.
    window: computeNoticeWindow({
      renewalDate: row.renewsOn ? row.renewsOn.toISOString().slice(0, 10) : null,
      noticeDays: row.noticeDays,
      now,
    }),
  };
}

export async function addCommitment(
  userId: string,
  input: CommitmentInput,
): Promise<CommitmentView> {
  const label = input.label.trim().slice(0, 120);
  if (!label) throw new CommitmentError("INVALID");

  const monthlyMinor =
    input.monthlyShekels === null || input.monthlyShekels === undefined
      ? null
      : shekelsToAgorot(input.monthlyShekels);
  if (monthlyMinor !== null && (!Number.isInteger(monthlyMinor) || monthlyMinor < 0)) {
    throw new CommitmentError("INVALID");
  }
  // A negative notice period is not a shorter one, it is a broken input.
  if (input.noticeDays != null && (!Number.isInteger(input.noticeDays) || input.noticeDays < 0)) {
    throw new CommitmentError("INVALID");
  }

  const row = await prisma.commitment.create({
    data: {
      userId,
      label,
      counterparty: (input.counterparty ?? "").trim().slice(0, 80),
      category: input.category ?? "other",
      monthlyMinor,
      renewsOn: input.renewsOn ?? null,
      noticeDays: input.noticeDays ?? null,
      source: input.source ?? "manual",
    },
  });
  return toView(row, new Date());
}

/** Everything still running for this person. */
export async function activeCommitments(
  userId: string,
  now: Date = new Date(),
): Promise<CommitmentView[]> {
  const rows = await prisma.commitment.findMany({
    where: { userId, endedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => toView(r, now));
}

/**
 * End a commitment rather than delete it. What somebody used to pay for is
 * part of the record — and it is the half that proves a cancellation actually
 * happened.
 */
export async function endCommitment(
  id: string,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  const existing = await prisma.commitment.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new CommitmentError("NOT_FOUND");
  await prisma.commitment.update({ where: { id: existing.id }, data: { endedAt: now } });
}

/**
 * The commitments as recurring charges, so the engines written against the
 * statement scanner run over them unchanged.
 *
 * Commitments with no known cost are excluded rather than counted as zero: an
 * overlap finder told a charge is free would rank it last, which is the
 * opposite of true for a contract nobody has priced yet.
 */
export function asRecurringCharges(items: readonly CommitmentView[]): RecurringCharge[] {
  return items
    .filter((c) => c.monthlyMinor !== null && c.monthlyMinor > 0)
    .map((c) => ({
      merchant: c.label,
      category: c.category,
      monthlyAgorot: c.monthlyMinor as number,
      occurrences: 1,
      // Only a registry-backed counterparty is a provider key. A free-text
      // name is a real commitment but not a known company, and pretending
      // otherwise would let it match provider logic it has no business in.
      providerKey: isProviderKey(c.counterparty) ? c.counterparty : null,
      chargedOn: [],
    }));
}

export interface CommitmentReview {
  /** Windows that are closing or already missed, soonest first. */
  acting: CommitmentView[];
  /** Pairs where two vendors are being paid for one job. */
  overlaps: ServiceOverlap[];
  /** Total known recurring cost, in agorot. */
  monthlyTotalMinor: number;
  /** How many commitments have no price yet — stated, never guessed at. */
  unpriced: number;
  /**
   * Commitments that renew but state no notice period. Their deadline is
   * unknowable from what we hold, and saying so is the honest answer.
   */
  unknownDeadline: number;
}

/**
 * The whole point, in one call: what needs doing about this person's
 * obligations right now.
 */
export async function reviewCommitments(
  userId: string,
  now: Date = new Date(),
): Promise<CommitmentReview> {
  const items = await activeCommitments(userId, now);
  const charges = asRecurringCharges(items);

  return {
    acting: needsAttention(items),
    overlaps: findOverlaps(charges),
    monthlyTotalMinor: charges.reduce((sum, c) => sum + c.monthlyAgorot, 0),
    unpriced: items.filter((c) => c.monthlyMinor === null).length,
    unknownDeadline: items.filter((c) => c.renewsOn !== null && c.noticeDays === null).length,
  };
}

/**
 * Commitments across all users whose notice window is closing, for the
 * digest.
 *
 * The database narrows by renewal date first so this stays a bounded query as
 * the table grows; the exact window is then decided per row by the same
 * `computeNoticeWindow` the screen uses, so a person is never told one thing
 * on the dashboard and another by email.
 */
export async function closingSoonAcrossUsers(
  now: Date = new Date(),
  horizonDays = 120,
): Promise<Map<string, CommitmentView[]>> {
  const horizon = new Date(now.getTime() + horizonDays * 86_400_000);
  const rows = await prisma.commitment.findMany({
    where: { endedAt: null, renewsOn: { not: null, lte: horizon }, noticeDays: { not: null } },
    orderBy: { renewsOn: "asc" },
  });

  const byUser = new Map<string, CommitmentView[]>();
  for (const row of rows) {
    const view = toView(row, now);
    if (view.window.state !== "closing" && view.window.state !== "missed") continue;
    const list = byUser.get(row.userId);
    if (list) list.push(view);
    else byUser.set(row.userId, [view]);
  }
  return byUser;
}
