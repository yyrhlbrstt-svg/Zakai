import "server-only";
import { prisma } from "@/lib/prisma";
import { shekelsToAgorot } from "@/lib/money";
import { MIN_SAMPLE } from "@/lib/companyScore";
import {
  reconcileCredit,
  type CreditVerdict,
  type PromisedCredit,
} from "@/lib/promisedCredit";

/**
 * The gap between "they said yes" and money.
 *
 * A case that reached agreement had two possible endings and both were wrong.
 * Settling it writes a SavingsProof and a chargeable Fee for money that has
 * not moved — charging a success fee on a promise is not a fee this company
 * could defend if asked. Leaving it lets the promise be forgotten, which is
 * the outcome the counterparty benefits from: the most reliable way to not pay
 * somebody is to promise to pay them and let it drift.
 *
 * So a promise is recorded as a promise. Nothing is claimed, no fee is raised,
 * and the case stays open at SENT. When the credit is observed the ordinary
 * settle path runs on the observed amount. When it is not, the broken promise
 * becomes a documented fact with a date on it.
 *
 * DELIBERATELY DOES NOT SETTLE THE CASE ITSELF
 *
 * A credit is a lump sum; a case may be a monthly renegotiation. Deriving a
 * "new monthly amount" from a one-time credit would be an invented mapping,
 * and an invented mapping in the fee path is a wrong charge. The arrival is
 * recorded here and the existing settle form — already on the same screen —
 * takes the amount from the person.
 */

export class PromiseError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "NOT_SENT"
      | "ALREADY_SETTLED"
      | "ALREADY_PROMISED"
      | "NO_PROMISE"
      | "INVALID_AMOUNT",
  ) {
    super(code);
    this.name = "PromiseError";
  }
}

export interface RecordPromiseInput {
  promisedShekels: number;
  /** By when they said it would appear. Null when they did not say. */
  dueBy?: Date | null;
  /** Where the promise came from, in the person's own words. Never parsed. */
  evidenceNote?: string;
}

async function ownedOpenCase(caseId: string, userId: string) {
  const kase = await prisma.case.findFirst({
    where: { id: caseId, userId },
    select: { id: true, status: true, provider: true },
  });
  if (!kase) throw new PromiseError("NOT_FOUND");
  return kase;
}

/**
 * Record what the counterparty said they would credit.
 *
 * Refuses on an already-settled case: a promise recorded after the money is
 * accounted for could only double-count it.
 */
export async function recordPromise(
  caseId: string,
  userId: string,
  input: RecordPromiseInput,
  now: Date = new Date(),
) {
  const kase = await ownedOpenCase(caseId, userId);
  if (kase.status !== "SENT") throw new PromiseError("NOT_SENT");

  const promisedMinor = shekelsToAgorot(input.promisedShekels);
  // A promise of nothing is not a promise, and signing a zero into the
  // broken-promise statistics would make the counterparty look worse for an
  // agreement that never existed.
  if (!Number.isInteger(promisedMinor) || promisedMinor <= 0) {
    throw new PromiseError("INVALID_AMOUNT");
  }

  const settled = await prisma.savingsProof.findUnique({
    where: { caseId },
    select: { id: true },
  });
  if (settled) throw new PromiseError("ALREADY_SETTLED");

  const existing = await prisma.promisedCreditRecord.findUnique({
    where: { caseId },
    select: { id: true },
  });
  if (existing) throw new PromiseError("ALREADY_PROMISED");

  return prisma.promisedCreditRecord.create({
    data: {
      caseId,
      counterparty: kase.provider,
      promisedMinor,
      promisedAt: now,
      dueBy: input.dueBy ?? null,
      evidenceNote: (input.evidenceNote ?? "").slice(0, 500),
    },
  });
}

export interface PromiseView {
  id: string;
  caseId: string;
  counterparty: string;
  promisedMinor: number;
  promisedAt: Date;
  dueBy: Date | null;
  /** Null until somebody actually checked a statement. */
  observedMinor: number | null;
  checkedAt: Date | null;
  evidenceNote: string;
  /**
   * Null until checked. An unchecked promise has no verdict — calling it
   * "missing" before anyone looked would report our own inattention as the
   * counterparty's failure.
   */
  verdict: CreditVerdict | null;
  /** True once it is late enough that checking is the next thing to do. */
  dueForCheck: boolean;
}

function toPromised(row: {
  counterparty: string;
  promisedMinor: number;
  promisedAt: Date;
  dueBy: Date | null;
}): PromisedCredit {
  return {
    counterparty: row.counterparty,
    promisedMinor: row.promisedMinor,
    promisedAt: row.promisedAt,
    dueBy: row.dueBy,
  };
}

function view(
  row: {
    id: string;
    caseId: string;
    counterparty: string;
    promisedMinor: number;
    promisedAt: Date;
    dueBy: Date | null;
    observedMinor: number | null;
    checkedAt: Date | null;
    evidenceNote: string;
  },
  now: Date,
): PromiseView {
  const verdict =
    row.observedMinor === null ? null : reconcileCredit(toPromised(row), row.observedMinor, now);
  // Whether it is time to look is a separate question from what was found, and
  // it is answered by running the same rule against a zero observation.
  const ifNothingCame = reconcileCredit(toPromised(row), 0, now);
  return {
    ...row,
    verdict,
    dueForCheck: row.checkedAt === null && ifNothingCame.state !== "pending",
  };
}

/**
 * The shape the dashboard panel renders, in shekels.
 *
 * Shares one `view()` with every other reader so the screen and the API can
 * never disagree about whether a promise is late — a panel that says "not yet"
 * next to an endpoint that says "overdue" is worse than either alone.
 */
export function promiseForClient(
  row: Parameters<typeof view>[0] | null | undefined,
  now: Date = new Date(),
) {
  if (!row) return null;
  const v = view(row, now);
  return {
    promisedShekels: Math.round(v.promisedMinor / 100),
    promisedAt: v.promisedAt.toISOString(),
    dueBy: v.dueBy?.toISOString() ?? null,
    observedShekels: v.observedMinor === null ? null : Math.round(v.observedMinor / 100),
    dueForCheck: v.dueForCheck,
    state: v.verdict?.state ?? null,
    shortfallShekels: v.verdict ? Math.round(v.verdict.shortfallMinor / 100) : null,
  };
}

/** The promise on one case, with its verdict when it has been checked. */
export async function loadPromise(
  caseId: string,
  userId: string,
  now: Date = new Date(),
): Promise<PromiseView | null> {
  const row = await prisma.promisedCreditRecord.findFirst({
    where: { caseId, case: { userId } },
  });
  return row ? view(row, now) : null;
}

/**
 * Record what actually landed.
 *
 * Zero is a legitimate answer and is stored as zero, not left null: "we looked
 * and nothing came" is the finding this whole record exists to capture, and
 * collapsing it into "not checked" would erase it.
 */
export async function checkPromise(
  caseId: string,
  userId: string,
  observedShekels: number,
  now: Date = new Date(),
): Promise<PromiseView> {
  const existing = await prisma.promisedCreditRecord.findFirst({
    where: { caseId, case: { userId } },
    select: { id: true },
  });
  if (!existing) throw new PromiseError("NO_PROMISE");

  const observedMinor = shekelsToAgorot(observedShekels);
  if (!Number.isInteger(observedMinor) || observedMinor < 0) {
    throw new PromiseError("INVALID_AMOUNT");
  }

  const row = await prisma.promisedCreditRecord.update({
    where: { id: existing.id },
    data: { observedMinor, checkedAt: now },
  });
  return view(row, now);
}

/**
 * Open promises across a person's cases — what the dashboard should be asking
 * about. Ordered by the ones that are already late.
 */
export async function openPromises(
  userId: string,
  now: Date = new Date(),
): Promise<PromiseView[]> {
  const rows = await prisma.promisedCreditRecord.findMany({
    where: { case: { userId }, checkedAt: null },
    orderBy: { promisedAt: "asc" },
  });
  return rows
    .map((r) => view(r, now))
    .sort((a, b) => Number(b.dueForCheck) - Number(a.dueForCheck) || b.promisedMinor - a.promisedMinor);
}

export interface BrokenPromiseRate {
  counterparty: string;
  /** Promises that were actually checked — the denominator. */
  checked: number;
  /** Checked promises where the money did not fully arrive. */
  broken: number;
  rate: number;
}

/**
 * How often a counterparty's promises turn into money.
 *
 * This is a fact nobody currently has. A complaint rate measures how often
 * people were unhappy enough to write in; this measures how often a company
 * agreed to pay and then did not — which is a different and much harder thing
 * to explain away.
 *
 * Only checked promises count. An unchecked promise measures our users'
 * follow-through, not the counterparty's, and letting it into the denominator
 * would make a company look better the less anyone verified.
 */
export async function brokenPromiseRates(
  now: Date = new Date(),
  minSample: number = MIN_SAMPLE,
): Promise<BrokenPromiseRate[]> {
  const rows = await prisma.promisedCreditRecord.findMany({
    where: { checkedAt: { not: null } },
    select: {
      counterparty: true,
      promisedMinor: true,
      promisedAt: true,
      dueBy: true,
      observedMinor: true,
    },
  });

  const byCounterparty = new Map<string, { checked: number; broken: number }>();
  for (const r of rows) {
    // Deliberately redundant with the query filter above. This decides what
    // gets said publicly about a named company, and the cost of the two
    // guards is nothing next to the cost of the query being edited later by
    // someone who did not know that was load-bearing.
    if (r.observedMinor === null) continue;
    const verdict = reconcileCredit(toPromised(r), r.observedMinor, now);
    const entry = byCounterparty.get(r.counterparty) ?? { checked: 0, broken: 0 };
    entry.checked += 1;
    if (verdict.state === "missing" || verdict.state === "partial") entry.broken += 1;
    byCounterparty.set(r.counterparty, entry);
  }

  return [...byCounterparty.entries()]
    // Below the sample floor a rate is an anecdote with a percent sign on it,
    // and this one names a company.
    .filter(([, v]) => v.checked >= minSample)
    .map(([counterparty, v]) => ({
      counterparty,
      checked: v.checked,
      broken: v.broken,
      rate: v.broken / v.checked,
    }))
    .sort((a, b) => b.rate - a.rate || b.checked - a.checked);
}
