import "server-only";

import { prismaRead } from "@/lib/prismaRead";
import { aggregateFairnessScores, type FairnessProviderScore } from "@/lib/fairnessScore";

/** De-identified outcome graph only — never Case/User rows. */
export async function loadFairnessScores(market: string): Promise<FairnessProviderScore[]> {
  const rows = await prismaRead.strategyOutcome.findMany({
    where: { market: market.toUpperCase(), selfReported: false },
    select: { counterparty: true, paid: true, recoveredMinor: true },
  });

  return aggregateFairnessScores(
    rows.map((r) => ({
      counterparty: r.counterparty,
      won: r.paid && r.recoveredMinor > 0,
    })),
  );
}
