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
    activeAuthorizations,
    delegatedIssuersActive,
    collectiveIntentSignals,
    attributedSignups,
    fairnessIl,
  ] = await Promise.all([
    prismaRead.strategyOutcome.count({ where: { selfReported: false } }),
    prismaRead.case.count({ where: { status: "SAVED" } }),
    prismaRead.authorization.count({
      where: { mandateJti: { not: null }, revokedAt: null },
    }),
    prismaRead.delegatedIssuer.count({
      where: { status: "active", NOT: { slug: { startsWith: "sandbox." } } },
    }),
    prismaRead.collectiveIntentSignal.count(),
    prismaRead.user.count({ where: { partnerRef: { not: null } } }),
    loadFairnessScores("IL").catch(() => []),
  ]);

  const marketsWithPacks = Object.keys(MARKETS).length;
  const marketsWithCitedRights = Object.values(MARKETS).filter(
    (m) => m.pack.rights.length > 0 && m.pack.rights.every((r) => r.source.trim().length > 0),
  ).length;

  return {
    verifiedOutcomes,
    savedCases,
    activeAuthorizations,
    registryIssuersActive: countActiveNetworkIssuers(),
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
