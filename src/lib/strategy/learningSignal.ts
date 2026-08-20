import "server-only";
import { prisma } from "@/lib/prisma";
import { recordOutcome, daysBetween } from "@/lib/strategy/store";
import { CANCEL_TEETH_RIGHT_ID } from "@/lib/legalTeeth";
import type { StrategyContext } from "@/lib/strategy/types";
import { documentedRecoveryMinor } from "@/lib/fee";
import { getRulePack } from "@/lib/verticals";
import { UNATTRIBUTED_VARIANT_ID } from "@/lib/strategy/normalizeKeys";

export { UNATTRIBUTED_VARIANT_ID };

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
 *
 * Missing strategyVariant still records under UNATTRIBUTED_VARIANT_ID so the
 * outcome graph is not starved on real settles (cohort learning still works;
 * stance attribution stays clean).
 */
export async function commitCaseLearningSignal(input: {
  caseId: string;
  context: StrategyContext;
  variantId: string | null;
  /** Model that wrote the draft, as "provider:model"; null when unattributed. */
  drafterId?: string | null;
  /** True when a signed settlement backs this outcome. */
  settlementBacked?: boolean;
  paid: boolean;
  recoveredMinor: number;
  days: number;
  selfReported?: boolean;
}): Promise<{ recorded: boolean; reason?: string }> {
  const variantId = input.variantId?.trim() || UNATTRIBUTED_VARIANT_ID;

  try {
    const kase = await prisma.case.findUnique({
      where: { id: input.caseId },
      select: {
        outcomeRecordedAt: true,
        status: true,
        amountOriginal: true,
        vertical: true,
      },
    });
    if (!kase) return { recorded: false, reason: "not_found" };
    if (kase.outcomeRecordedAt) return { recorded: false, reason: "already" };
    if (kase.status !== "SAVED" && kase.status !== "NO_SAVING") {
      return { recorded: false, reason: "not_settled" };
    }

    /**
     * The pricing fields — what turns this row into an asset even when
     * paid=false. Each derived from something the pipeline actually knows,
     * never from intent: the claim basis is the case's documented
     * before-amount; the escalation stage counts what the Outbox really
     * dispatched (one letter settled it vs. it took more); the right id maps
     * the vertical to the Rights Graph entry its letters invoke. Every
     * lookup fails soft to null — an unpriced outcome is still an outcome.
     */
    let escalationStage: string | null = null;
    try {
      const sends = await prisma.outbox.count({
        where: { caseId: input.caseId, channel: "EMAIL" },
      });
      escalationStage = sends > 1 ? "followup" : sends === 1 ? "letter" : null;
    } catch {
      escalationStage = null;
    }

    await recordOutcome({
      context: input.context,
      variantId,
      drafterId: input.drafterId,
      settlementBacked: input.settlementBacked,
      paid: input.paid,
      recoveredMinor: input.recoveredMinor,
      days: input.days,
      selfReported: input.selfReported,
      claimBasisMinor: kase.amountOriginal > 0 ? kase.amountOriginal : null,
      escalationStage,
      rightId: kase.vertical === "subscription" ? CANCEL_TEETH_RIGHT_ID : null,
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
 * Includes null strategyVariant → UNATTRIBUTED_VARIANT_ID.
 */
export async function backfillSettledLearningSignals(opts?: {
  take?: number;
}): Promise<{ examined: number; recorded: number }> {
  const take = opts?.take ?? 50;
  const rows = await prisma.case.findMany({
    where: {
      status: { in: ["SAVED", "NO_SAVING"] },
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
