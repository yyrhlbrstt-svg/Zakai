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
    // Same rule as monopolyRails.ts: a public read-only counter degrades to
    // 0 on a DB hiccup, it does not take the whole page down with it.
    prismaRead.strategyOutcome.count({ where: { selfReported: false } }).catch(() => 0),
    prismaRead.case.count({ where: { status: "SAVED" } }).catch(() => 0),
    prismaRead.authorization
      .count({
        where: {
          mandateJti: { not: null },
          revokedAt: null,
        },
      })
      .catch(() => 0),
    prismaRead.delegatedIssuer.count({ where: { status: "active" } }).catch(() => 0),
    prismaRead.collectiveIntentSignal.count().catch(() => 0),
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
