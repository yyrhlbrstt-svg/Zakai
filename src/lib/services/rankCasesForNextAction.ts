import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveCaseOutreachTo } from "@/lib/caseOutreach";
import {
  cohortLearning,
  expectedRecoveryAgorot,
  type LearningOutcomeRow,
} from "@/lib/strategy/learningInsights";
import type { NextActionCaseInput } from "@/lib/services/nextAction";

type CaseRow = {
  id: string;
  status: string;
  provider: string;
  vertical: string;
  amountOriginal: number;
  targetAmount: number;
  counterpartyEmail: string | null;
  fee: { amount: number; status: string } | null;
  authorization: { status: string } | null;
};

/**
 * Shared next-action inputs for dashboard / money — EV from StrategyOutcome
 * when volume exists, outreach via catalog resolve (same as send path).
 */
export async function buildRankedCaseInputs(
  cases: readonly CaseRow[],
  agentRounds: ReadonlyMap<string, number>,
): Promise<NextActionCaseInput[]> {
  const rows =
    cases.length === 0
      ? ([] as LearningOutcomeRow[])
      : await prisma.strategyOutcome
          .findMany({
            where: {
              market: "IL",
              createdAt: { gte: new Date(Date.now() - 540 * 86_400_000) },
            },
            select: {
              market: true,
              vertical: true,
              counterparty: true,
              variantId: true,
              paid: true,
              recoveredMinor: true,
              days: true,
              selfReported: true,
            },
            take: 8_000,
            orderBy: { createdAt: "desc" },
          })
          .catch(() => [] as LearningOutcomeRow[]);

  const cohortCache = new Map<string, ReturnType<typeof cohortLearning>>();
  return cases.map((c) => {
    const key = `${c.vertical}::${c.provider}`;
    if (!cohortCache.has(key)) {
      cohortCache.set(key, cohortLearning(rows, "IL", c.vertical, c.provider));
    }
    const cohort = cohortCache.get(key);
    return {
      id: c.id,
      status: c.status,
      fee: c.fee,
      agentRound: agentRounds.get(c.id) ?? 0,
      mandateActive: c.authorization?.status === "ACTIVE",
      hasOutreachEmail: Boolean(
        resolveCaseOutreachTo({
          counterpartyEmail: c.counterpartyEmail,
          provider: c.provider,
          vertical: c.vertical,
        }),
      ),
      expectedRecoveryAgorot: expectedRecoveryAgorot(
        c.amountOriginal,
        c.targetAmount,
        cohort?.winRate ?? null,
      ),
    };
  });
}
