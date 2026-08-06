import "server-only";

import { prismaRead } from "@/lib/prismaRead";
import { countActiveNetworkIssuers } from "@/lib/mandate/trustRegistry";
import { MARKETS } from "@/lib/global/registry";
import { assessSevenRails, type SevenRailsInputs } from "@/lib/monopoly/sevenRails";
import { loadFairnessScores } from "@/lib/services/fairnessScores";
import { packsRoot } from "@/lib/protocol/packs/serveLocal";
import { singleflight } from "@/lib/scale/singleflight";

async function loadSevenRailsInputsRaw(): Promise<SevenRailsInputs> {
  const [
    verifiedOutcomes,
    savedCases,
    casesSent,
    activeAuthorizations,
    delegatedIssuersActive,
    collectiveIntentSignals,
    attributedSignups,
    fairnessIl,
  ] = await Promise.all([
    // Read-only aggregates for a public dashboard — an unreachable DB should
    // degrade one number to 0, not 500 the whole page (loadFairnessScores
    // already followed this rule; the rest didn't).
    prismaRead.strategyOutcome.count({ where: { selfReported: false } }).catch(() => 0),
    prismaRead.case.count({ where: { status: "SAVED" } }).catch(() => 0),
    prismaRead.case
      .count({
        where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } },
      })
      .catch(() => 0),
    prismaRead.authorization
      .count({
        where: { mandateJti: { not: null }, revokedAt: null },
      })
      .catch(() => 0),
    prismaRead.delegatedIssuer
      .count({
        where: { status: "active", NOT: { slug: { startsWith: "sandbox." } } },
      })
      .catch(() => 0),
    prismaRead.collectiveIntentSignal.count().catch(() => 0),
    prismaRead.user.count({ where: { partnerRef: { not: null } } }).catch(() => 0),
    loadFairnessScores("IL").catch(() => []),
  ]);

  const marketsWithPacks = Object.keys(MARKETS).length;
  const marketsWithCitedRights = Object.values(MARKETS).filter(
    (m) => m.pack.rights.length > 0 && m.pack.rights.every((r) => r.source.trim().length > 0),
  ).length;

  return {
    verifiedOutcomes,
    savedCases,
    casesSent,
    activeAuthorizations,
    registryIssuersActive: await countActiveNetworkIssuers(),
    delegatedIssuersActive,
    collectiveIntentSignals,
    marketsWithPacks,
    proofsDocumented: savedCases,
    marketsWithCitedRights,
    fairnessProvidersScored: fairnessIl.length,
    attributedSignups,
    packsOriginMirror: Boolean(packsRoot()),
  };
}

export async function loadSevenRailsReport() {
  return singleflight("seven-rails-report", 60_000, async () => {
    const inputs = await loadSevenRailsInputsRaw();
    return assessSevenRails(inputs);
  });
}
