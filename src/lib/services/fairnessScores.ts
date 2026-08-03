import "server-only";

import { prismaRead } from "@/lib/prismaRead";
import { aggregateFairnessScores, type FairnessProviderScore } from "@/lib/fairnessScore";
import { singleflight } from "@/lib/scale/singleflight";

/** De-identified outcome graph only — never Case/User rows. */
export async function loadFairnessScores(market: string): Promise<FairnessProviderScore[]> {
  return singleflight(`fairness:${market.toUpperCase()}`, 60_000, async () => {
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
  });
}
