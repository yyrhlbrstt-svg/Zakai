import { prisma } from "@/lib/prisma";

/**
 * Aggregate, honest impact numbers for the public results page. Every figure
 * comes from real rows in the append-only ledger — never typed in, never
 * estimated up. On day one these are legitimately zero (or small), and the
 * page frames that honestly ("be among the first") rather than faking traction.
 *
 * - `documentedMonthlyAgorot`  sum of proven monthly savings (the ledger)
 * - `documentedCount`          how many checks reached a documented saving
 * - `checksRun`                total checks users have started
 * - `potentialMonthlyAgorot`   before→target gap identified across open checks
 */
export interface ImpactStats {
  documentedMonthlyAgorot: number;
  documentedCount: number;
  checksRun: number;
  potentialMonthlyAgorot: number;
}

const EMPTY: ImpactStats = {
  documentedMonthlyAgorot: 0,
  documentedCount: 0,
  checksRun: 0,
  potentialMonthlyAgorot: 0,
};

export async function computeImpact(): Promise<ImpactStats> {
  try {
    const [savingAgg, documentedCount, checksRun, cases] = await Promise.all([
      prisma.savingsProof.aggregate({ _sum: { savingMonthly: true } }),
      prisma.savingsProof.count({ where: { savingMonthly: { gt: 0 } } }),
      prisma.case.count(),
      prisma.case.findMany({ select: { amountOriginal: true, targetAmount: true } }),
    ]);

    const potentialMonthlyAgorot = cases.reduce(
      (sum, c) => sum + Math.max(0, c.amountOriginal - c.targetAmount),
      0,
    );

    return {
      documentedMonthlyAgorot: savingAgg._sum.savingMonthly ?? 0,
      documentedCount,
      checksRun,
      potentialMonthlyAgorot,
    };
  } catch {
    // A missing/unreachable DB must never break a public marketing page.
    return EMPTY;
  }
}
