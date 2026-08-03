import "server-only";
import { prisma } from "@/lib/prisma";
import { recordOutcome, daysBetween } from "@/lib/strategy/store";
import type { StrategyContext } from "@/lib/strategy/types";
import { documentedRecoveryMinor } from "@/lib/fee";
import { getRulePack } from "@/lib/verticals";

/**
 * First outbound letter clock — send→settle, not approve→settle.
 * Excludes inbound paste / webhook logs that never left the system.
 */
export async function firstOutboundAt(caseId: string): Promise<Date | null> {
  const row = await prisma.outbox.findFirst({
    where: {
      caseId,
      channel: "EMAIL",
      // Inbound paste/webhook rows are not Mandates leaving the system.
      NOT: { providerMessageId: "inbound" },
    },
    orderBy: { createdAt: "asc" },
    select: { sentAt: true, createdAt: true },
  });
  if (!row) return null;
  return row.sentAt ?? row.createdAt;
}

/** Whole days from first outbound (fallback: approve/create) to settle. */
export async function daysToSettle(caseId: string, fallbackStart: Date): Promise<number> {
  const start = (await firstOutboundAt(caseId)) ?? fallbackStart;
  return daysBetween(start, new Date());
}

/**
 * Commit a de-identified learning signal for a closed case, exactly once.
 * StrategyOutcome never gets a Case FK — Case.outcomeRecordedAt is the latch.
 *
 * Only call this when the case has settled (SAVED / NO_SAVING). Never write a
 * provisional loss for an open SENT case — that would block a later real win.
 */
export async function commitCaseLearningSignal(input: {
  caseId: string;
  context: StrategyContext;
  variantId: string | null;
  paid: boolean;
  recoveredMinor: number;
  days: number;
  selfReported?: boolean;
}): Promise<{ recorded: boolean; reason?: string }> {
  if (!input.variantId) {
    return { recorded: false, reason: "no_variant" };
  }

  try {
    const kase = await prisma.case.findUnique({
      where: { id: input.caseId },
      select: { outcomeRecordedAt: true, status: true },
    });
    if (!kase) return { recorded: false, reason: "not_found" };
    if (kase.outcomeRecordedAt) return { recorded: false, reason: "already" };
    if (kase.status !== "SAVED" && kase.status !== "NO_SAVING") {
      return { recorded: false, reason: "not_settled" };
    }

    await recordOutcome({
      context: input.context,
      variantId: input.variantId,
      paid: input.paid,
      recoveredMinor: input.recoveredMinor,
      days: input.days,
      selfReported: input.selfReported,
    });

    await prisma.case.update({
      where: { id: input.caseId },
      data: { outcomeRecordedAt: new Date() },
    });
    return { recorded: true };
  } catch (err) {
    console.warn("[learning] commit failed:", err);
    return { recorded: false, reason: "error" };
  }
}

/**
 * Backfill learning signals for settled cases that closed before the latch
 * existed, or where recordOutcome failed open. Idempotent.
 */
export async function backfillSettledLearningSignals(opts?: {
  take?: number;
}): Promise<{ examined: number; recorded: number }> {
  const take = opts?.take ?? 50;
  const rows = await prisma.case.findMany({
    where: {
      status: { in: ["SAVED", "NO_SAVING"] },
      strategyVariant: { not: null },
      outcomeRecordedAt: null,
      savingsProof: { isNot: null },
    },
    select: {
      id: true,
      vertical: true,
      provider: true,
      strategyVariant: true,
      approvedAt: true,
      createdAt: true,
      savingsProof: { select: { savingMonthly: true, selfReported: true } },
    },
    take,
    orderBy: { updatedAt: "asc" },
  });

  let recorded = 0;
  for (const c of rows) {
    const saving = c.savingsProof?.savingMonthly ?? 0;
    const basis = getRulePack(c.vertical)?.feeBasis ?? "monthly";
    const result = await commitCaseLearningSignal({
      caseId: c.id,
      context: {
        market: "IL",
        vertical: c.vertical,
        counterparty: c.provider,
      },
      variantId: c.strategyVariant,
      paid: saving > 0,
      recoveredMinor: documentedRecoveryMinor(saving, basis),
      days: await daysToSettle(c.id, c.approvedAt ?? c.createdAt),
      selfReported: c.savingsProof?.selfReported === true,
    });
    if (result.recorded) recorded += 1;
  }
  return { examined: rows.length, recorded };
}
