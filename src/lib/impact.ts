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
 *
 * `documentedMonthlyAgorot`/`documentedCount` filter to `selfReported: false`
 * — this file's own claim above ("never typed in") was false until this
 * filter existed: SavingsProof also holds self-reported rows (somebody's
 * word, entered via OutcomeReport.tsx for the six verticals that never
 * produce a provider reply), and those were being summed in here right next
 * to a sentence promising they weren't. Same bug, same fix, as the homepage's
 * loadProof() — see provenSavings() in selfReportedSaving.ts for the
 * intended split; this file predates that helper and duplicates its filter
 * rather than importing it, since it also needs `checksRun` and
 * `potentialMonthlyAgorot`, which are outside that helper's scope.
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
    // Sum the per-row, floored-at-zero potential in the DB rather than loading
    // every Case row into memory — the marketing page must stay O(1) as the
    // table grows. GREATEST(...,0) mirrors the old Math.max(0, ...) per row.
    const [savingAgg, documentedCount, checksRun, potentialRows] = await Promise.all([
      prisma.savingsProof.aggregate({
        where: { selfReported: false },
        _sum: { savingMonthly: true },
      }),
      prisma.savingsProof.count({ where: { selfReported: false, savingMonthly: { gt: 0 } } }),
      prisma.case.count(),
      prisma.$queryRaw<{ total: bigint | null }[]>`
        SELECT COALESCE(SUM(GREATEST("amountOriginal" - "targetAmount", 0)), 0) AS total
        FROM "Case"
      `,
    ]);

    const potentialMonthlyAgorot = Number(potentialRows[0]?.total ?? 0);

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
