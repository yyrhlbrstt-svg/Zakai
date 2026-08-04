import "server-only";

import { prismaRead } from "@/lib/prismaRead";
import { ISSUERS } from "@/lib/mandate/trustRegistry";
import { MARKETS } from "@/lib/global/registry";
import { buildGravitySnapshot } from "@/lib/monopoly/gravity";
import { singleflight } from "@/lib/scale/singleflight";

/**
 * Load real counters for public gravity API — never estimate or seed.
 */
export async function loadNetworkGravityInputs() {
  const [
    verifiedOutcomes,
    savedCases,
    activeAuthorizations,
    delegatedIssuersActive,
    collectiveIntentSignals,
  ] = await Promise.all([
    prismaRead.strategyOutcome.count({ where: { selfReported: false } }),
    prismaRead.case.count({ where: { status: "SAVED" } }),
    prismaRead.authorization.count({
      where: {
        mandateJti: { not: null },
        revokedAt: null,
      },
    }),
    prismaRead.delegatedIssuer.count({ where: { status: "active" } }),
    prismaRead.collectiveIntentSignal.count(),
  ]);

  const registryIssuersActive = ISSUERS.filter((i) => i.status === "active").length;
  const marketsWithPacks = Object.keys(MARKETS).length;

  return {
    verifiedOutcomes,
    savedCases,
    activeAuthorizations,
    registryIssuersActive,
    delegatedIssuersActive,
    collectiveIntentSignals,
    marketsWithPacks,
  };
}

export async function loadNetworkGravitySnapshot() {
  return singleflight("network-gravity", 60_000, async () => {
    const inputs = await loadNetworkGravityInputs();
    return buildGravitySnapshot(inputs);
  });
}
