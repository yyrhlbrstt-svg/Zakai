import "server-only";

import { prisma } from "@/lib/prisma";
import { ISSUERS } from "@/lib/mandate/trustRegistry";
import { MARKETS } from "@/lib/global/registry";
import { buildGravitySnapshot } from "@/lib/monopoly/gravity";

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
    prisma.strategyOutcome.count({ where: { selfReported: false } }),
    prisma.case.count({ where: { status: "SAVED" } }),
    prisma.authorization.count({
      where: {
        mandateJti: { not: null },
        revokedAt: null,
      },
    }),
    prisma.delegatedIssuer.count({ where: { status: "active" } }),
    prisma.collectiveIntentSignal.count(),
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
  const inputs = await loadNetworkGravityInputs();
  return buildGravitySnapshot(inputs);
}
