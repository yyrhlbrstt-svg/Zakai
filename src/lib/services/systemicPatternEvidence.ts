import "server-only";

import { prismaRead } from "@/lib/prismaRead";
import { aggregateSystemicPatternReport, type SystemicPatternReport } from "@/lib/companyScore";
import { singleflight } from "@/lib/scale/singleflight";

/**
 * De-identified outcome graph only — never Case/User rows — same source
 * loadFairnessScores reads, filtered to one named provider. Verified
 * (non-self-reported) outcomes only: a licensed evidence consumer needs
 * documented settlements, not somebody's recollection.
 */
export async function loadSystemicPatternReport(
  market: string,
  provider: string,
): Promise<SystemicPatternReport | null> {
  return singleflight(`systemic-pattern:${market.toUpperCase()}:${provider}`, 60_000, async () => {
    try {
      const rows = await prismaRead.strategyOutcome.findMany({
        where: { market: market.toUpperCase(), counterparty: provider, selfReported: false },
        select: { paid: true, recoveredMinor: true, days: true, createdAt: true },
      });
      return aggregateSystemicPatternReport(rows);
    } catch {
      // A missing/unreachable DB must never crash a paid API call — same
      // resilience pattern as loadFairnessScores/computeImpact.
      return null;
    }
  });
}
