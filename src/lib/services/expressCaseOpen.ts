import "server-only";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CaseError } from "@/lib/services/cases";
import { dispatchAgent } from "@/lib/services/dispatch";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { buildRankedCaseInputs } from "@/lib/services/rankCasesForNextAction";
import { nextActionHref, rankNextAction } from "@/lib/services/nextAction";

export type ExpressSendResult = {
  dispatched: boolean;
  delivered: boolean;
  /** CaseError message when express dispatch failed (fail-open for case create). */
  blockReason?: string;
};

/**
 * After createCase(+autoApprove): same gesture → Mandate SENT when the
 * account already proved email control and ownership was primed.
 * Fail-open: never block case creation if dispatch cannot complete —
 * but surface CaseError reasons so clients can recover on /money.
 */
export async function tryExpressMandateSend(
  caseId: string,
  userId: string,
  emailVerifiedAt: Date | string | null | undefined,
): Promise<ExpressSendResult> {
  if (!emailVerifiedAt) return { dispatched: false, delivered: false };
  try {
    const d = await dispatchAgent(caseId, userId);
    return { dispatched: true, delivered: d.delivered };
  } catch (err) {
    if (err instanceof CaseError) {
      return { dispatched: false, delivered: false, blockReason: err.message };
    }
    return { dispatched: false, delivered: false };
  }
}

/** JSON body fragment for vertical open responses. */
export function expressOpenBody<T extends Record<string, unknown> = Record<string, never>>(input: {
  caseId: string;
  dispatched: boolean;
  delivered: boolean;
  blockReason?: string;
  /** Soft-open pre-check (e.g. from-scan) — OR'd with NEEDS_OUTREACH_EMAIL block. */
  needsOutreachEmail?: boolean;
  extra?: T;
}): {
  caseId: string;
  message: "mandate_sent" | "case_opened";
  dispatched: boolean;
  delivered: boolean;
  needsOutreachEmail: boolean;
  blockReason?: string;
} & T {
  const needsOutreachEmail =
    input.needsOutreachEmail === true || input.blockReason === "NEEDS_OUTREACH_EMAIL";
  return {
    caseId: input.caseId,
    // Only claim mandate_sent when SMTP/Outbox actually accepted delivery.
    message: input.delivered ? ("mandate_sent" as const) : ("case_opened" as const),
    dispatched: input.dispatched,
    delivered: input.delivered,
    needsOutreachEmail,
    ...(input.blockReason ? { blockReason: input.blockReason } : {}),
    ...(input.extra ?? ({} as T)),
  };
}

export type OpenLoopBlock = {
  error: "OPEN_LOOP";
  nextHref: string;
  caseId?: string;
};

/**
 * OS rule: finish the ranked open loop before forking another Case.
 * Returns a block payload when the user already has unfinished work.
 */
export async function findOpenLoopBlock(userId: string): Promise<OpenLoopBlock | null> {
  const openCases = await prisma.case.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      provider: true,
      vertical: true,
      amountOriginal: true,
      targetAmount: true,
      counterpartyEmail: true,
      fee: { select: { amount: true, status: true } },
      authorization: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  if (openCases.length === 0) return null;

  const sentIds = openCases.filter((c) => c.status === "SENT").map((c) => c.id);
  const [proposedMap, agentRounds] = await Promise.all([
    sentIds.length > 0 ? getProposedSavingsMap(sentIds) : Promise.resolve(new Map()),
    getAgentRoundMap(sentIds),
  ]);
  const proposedHints = new Map(
    [...proposedMap.entries()].map(([id, p]) => [id, { newAmountShekels: p.newAmountShekels }]),
  );
  const ranked = rankNextAction(
    await buildRankedCaseInputs(openCases, agentRounds),
    proposedHints,
  );
  if (ranked.kind === "start_money") return null;
  const { paymentsFullyLive } = await import("@/lib/deploy/releaseGate");
  return {
    error: "OPEN_LOOP",
    nextHref: nextActionHref(ranked, { paymentsLive: paymentsFullyLive() }),
    caseId: "caseId" in ranked ? ranked.caseId : undefined,
  };
}

/** 409 response when an open loop must be finished first. */
export async function openLoopConflictIfAny(userId: string): Promise<NextResponse | null> {
  const block = await findOpenLoopBlock(userId);
  if (!block) return null;
  return NextResponse.json(block, { status: 409 });
}
