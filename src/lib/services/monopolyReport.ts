import "server-only";

import { emailConfigured } from "@/lib/messaging";
import { loadPipeNetworkVolume } from "@/lib/pipe/loadPipeNetwork";
import { planMonopolyLoop, type MonopolyLoopPlan } from "@/lib/monopoly/gravityLoop";
import { MONOPOLY_RAIL, type SevenRailsReport } from "@/lib/monopoly/sevenRails";
import { loadSevenRailsReport } from "@/lib/services/monopolyRails";
import { singleflight } from "@/lib/scale/singleflight";

export type MonopolyNetworkReport = SevenRailsReport & {
  pipe: Awaited<ReturnType<typeof loadPipeNetworkVolume>>;
  monopolyLoop: MonopolyLoopPlan;
  smtpConfigured: boolean;
};

/**
 * Public monopoly scoreboard: seven rails + pipe gravity + next execution move.
 */
export async function loadMonopolyReport(): Promise<MonopolyNetworkReport> {
  return singleflight("monopoly-network-report", 60_000, async () => {
    const [rails, pipe] = await Promise.all([loadSevenRailsReport(), loadPipeNetworkVolume()]);
    const smtpConfigured = emailConfigured();
    const closed = rails.rails.find((r) => r.id === MONOPOLY_RAIL.CLOSED_LOOP);
    const mandate = rails.rails.find((r) => r.id === MONOPOLY_RAIL.MANDATE);
    const delegatedEvidence = mandate?.evidence.find((e) => e.startsWith("delegated_issuers="));
    const delegatedIssuersActive = delegatedEvidence
      ? Number(delegatedEvidence.split("=")[1] ?? 0) || 0
      : 0;

    const monopolyLoop = planMonopolyLoop({
      smtpConfigured,
      pipe: {
        mandatesIssued: pipe.mandatesIssued,
        casesSent: pipe.casesSent,
        savingsProofs: pipe.savingsProofs,
        verifiedRecoveredMinor: pipe.verifiedRecoveredMinor,
        gravity_tier: pipe.gravity_tier,
      },
      infrastructureScore: rails.infrastructureScore,
      closedLoopMaturity: closed?.maturity ?? "skeleton",
      mandateMaturity: mandate?.maturity ?? "skeleton",
      delegatedIssuersActive,
    });

    return {
      ...rails,
      pipe,
      monopolyLoop,
      smtpConfigured,
    };
  });
}
