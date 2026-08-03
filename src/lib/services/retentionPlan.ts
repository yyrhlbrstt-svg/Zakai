import "server-only";

import { prisma } from "@/lib/prisma";
import { planRetentionActions, type RetentionUserSnapshot } from "@/lib/monopoly/retentionEngine";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { buildRankedCaseInputs } from "@/lib/services/rankCasesForNextAction";
import { nextActionHref, rankNextAction } from "@/lib/services/nextAction";

export async function loadRetentionSnapshot(userId: string): Promise<RetentionUserSnapshot> {
  const now = Date.now();
  const [
    lastCase,
    openAnalyzedOrApproved,
    openVerifiedReadyToSend,
    openSent,
    savedCount,
    householdBeneficiaryCases,
    upcomingDeadlines,
    openVigilAlerts,
  ] = await Promise.all([
    prisma.case.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.case.count({
      where: { userId, status: { in: ["ANALYZED", "APPROVED"] } },
    }),
    prisma.case.count({
      where: { userId, status: "VERIFIED" },
    }),
    prisma.case.count({
      where: { userId, status: "SENT" },
    }),
    prisma.case.count({
      where: { userId, status: "SAVED" },
    }),
    prisma.case.count({
      where: { userId, NOT: { beneficiaryLabel: "" } },
    }),
    prisma.deadline.count({
      where: {
        userId,
        dueDate: { lte: new Date(now + 14 * 86_400_000) },
        notifiedAt: null,
      },
    }),
    prisma.vigilAlert
      .count({
        where: {
          userId,
          sentAt: { gte: new Date(now - 30 * 86_400_000) },
        },
      })
      .catch(() => 0),
  ]);

  const daysSinceLastServerCase = lastCase
    ? Math.floor((now - lastCase.createdAt.getTime()) / 86_400_000)
    : null;

  return {
    daysSinceLastServerCase,
    openAnalyzedOrApproved,
    openVerifiedReadyToSend,
    openSent,
    savedWithoutRecentShare: savedCount > 0,
    householdBeneficiaryCases,
    upcomingDeadlines,
    openVigilAlerts,
    hasAnySaved: savedCount > 0,
  };
}

/**
 * Retention strip deep-links the single highest-ROI case when the ranker
 * knows one — bare /dashboard is a drop-off.
 */
export async function loadRetentionPlan(userId: string) {
  const snap = await loadRetentionSnapshot(userId);
  const actions = planRetentionActions(snap);

  const cases = await prisma.case.findMany({
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
  if (cases.length === 0) return actions;

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  const [proposedMap, agentRounds] = await Promise.all([
    sentIds.length > 0 ? getProposedSavingsMap(sentIds) : Promise.resolve(new Map()),
    getAgentRoundMap(sentIds),
  ]);
  const proposedHints = new Map(
    [...proposedMap.entries()].map(([id, p]) => [id, { newAmountShekels: p.newAmountShekels }]),
  );
  const ranked = rankNextAction(await buildRankedCaseInputs(cases, agentRounds), proposedHints);
  if (ranked.kind === "start_money") return actions;

  const deep = nextActionHref(ranked);
  return actions.map((a) => {
    if (
      a.kind === "complete_send" ||
      a.kind === "follow_up" ||
      a.kind === "document_saving" ||
      a.kind === "share_proof" ||
      a.kind === "vigil"
    ) {
      return { ...a, href: deep };
    }
    return a;
  });
}
