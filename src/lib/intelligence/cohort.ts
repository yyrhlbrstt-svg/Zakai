import "server-only";

import { prisma } from "@/lib/prisma";
import { MIN_SAMPLE } from "@/lib/companyScore";

export interface CohortInsight {
  similar_outcomes: number;
  win_rate: number | null;
  avg_recovered_minor: number | null;
}

/**
 * De-identified cohort stats — market + vertical + counterparty only (no user id).
 */
export async function getCohortInsight(
  market: string,
  vertical: string,
  counterparty: string,
): Promise<CohortInsight | null> {
  const rows = await prisma.strategyOutcome.findMany({
    where: { market: market.toUpperCase(), vertical, counterparty, selfReported: false },
    select: { paid: true, recoveredMinor: true },
    take: 5000,
  });
  if (rows.length < MIN_SAMPLE) return null;
  const wins = rows.filter((r) => r.paid && r.recoveredMinor > 0);
  const win_rate = wins.length / rows.length;
  const avg =
    wins.length > 0
      ? Math.round(wins.reduce((s, r) => s + r.recoveredMinor, 0) / wins.length)
      : null;
  return {
    similar_outcomes: rows.length,
    win_rate,
    avg_recovered_minor: avg,
  };
}
