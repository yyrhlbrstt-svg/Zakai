import "server-only";
import { prisma } from "@/lib/prisma";
import { PLANS, planConfig } from "@/lib/plans";
import { computeInsights, type CaseLite, type InsightInput } from "@/lib/insights";

/** Load the user's data and derive rule-based insights (pure logic in lib/insights). */
export async function buildInsights(userId: string) {
  // Independent of each other — both keyed only on userId.
  const [user, cases] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, referralCreditAgorot: true },
    }),
    prisma.case.findMany({
      where: { userId },
      select: {
        status: true,
        amountOriginal: true,
        targetAmount: true,
        fee: { select: { amount: true } },
        savingsProof: { select: { savingMonthly: true, recordedAt: true } },
      },
    }),
  ]);

  const input: InsightInput = {
    plan: planConfig(user?.plan).id,
    referralCreditAgorot: user?.referralCreditAgorot ?? 0,
    proPriceAgorot: PLANS.PRO.priceAgorot,
    cases: cases.map(
      (c): CaseLite => ({
        status: c.status,
        amountOriginal: c.amountOriginal,
        targetAmount: c.targetAmount,
        feeAgorot: c.fee?.amount ?? 0,
        savedMonthlyAgorot: c.savingsProof?.savingMonthly ?? 0,
        settledAgeDays: c.savingsProof
          ? Math.floor((Date.now() - c.savingsProof.recordedAt.getTime()) / 86_400_000)
          : undefined,
      }),
    ),
  };
  return computeInsights(input);
}
