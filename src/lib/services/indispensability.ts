import "server-only";

import { loadNetworkGravitySnapshot } from "@/lib/services/networkGravity";
import { loadMonopolyReport } from "@/lib/services/monopolyReport";
import { loadTrillionGatesReport } from "@/lib/services/trillionGates";
import { buildIndispensabilityDocument } from "@/lib/monopoly/indispensability";
import { singleflight } from "@/lib/scale/singleflight";

export async function loadIndispensabilityReport(origin: string) {
  return singleflight(`indispensability:${origin}`, 120_000, async () => {
    const [gravity, monopoly, control] = await Promise.all([
      loadNetworkGravitySnapshot(),
      loadMonopolyReport(),
      loadTrillionGatesReport(origin),
    ]);

    return {
      ...buildIndispensabilityDocument({
        origin,
        gravityIndex: gravity.assessment.gravityIndex,
        infrastructureScore: monopoly.infrastructureScore,
        pipeGravityTier: monopoly.pipe.gravity_tier,
        monopolyP0Id: monopoly.monopolyLoop.p0.id,
        control: {
          phase: control.phase,
          gatesPassed: control.gatesPassed,
          gatesTotal: control.gatesTotal,
          nextBlocker: control.nextBlocker,
          disclaimer: control.disclaimer,
        },
      }),
      assessedAt: new Date().toISOString(),
      railsSummary: monopoly.rails.map((r) => ({ id: r.id, maturity: r.maturity, score: r.score })),
      monopolyP0: monopoly.monopolyLoop.p0,
      pipe: {
        gravity_tier: monopoly.pipe.gravity_tier,
        mandatesIssued: monopoly.pipe.mandatesIssued,
        casesSent: monopoly.pipe.casesSent,
        savingsProofs: monopoly.pipe.savingsProofs,
      },
      gates: control.gates.map((g) => ({ id: g.id, passed: g.passed, evidence: g.evidence })),
    };
  });
}
