import "server-only";

import { prismaRead } from "@/lib/prismaRead";
import { countActiveNetworkIssuers } from "@/lib/mandate/trustRegistry";
import { MARKETS } from "@/lib/global/registry";
import { loadFairnessScores } from "@/lib/services/fairnessScores";
import { packsRoot } from "@/lib/protocol/packs/serveLocal";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";
import {
  aggregateInboundPressure,
  disclosedInboundPressure,
  pressureRowsFromCases,
  CASE_PRESSURE_SELECT,
} from "@/lib/institutionInboundPressure";
import { evaluateTrillionGates } from "@/lib/monopoly/trillionGates";
import { singleflight } from "@/lib/scale/singleflight";
import { prisma } from "@/lib/prisma";

async function probeUrlOk(url: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function loadGateInputs(origin: string) {
  const [
    fairness,
    cases,
    referenceVerifiers,
    delegatedIssuersActive,
    attributedSignups,
    savedCases,
    marketOutcomes,
  ] = await Promise.all([
    loadFairnessScores("IL").catch(() => []),
    prismaRead.case
      .findMany({
        where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } },
        select: CASE_PRESSURE_SELECT,
      })
      .catch(() => [] as Parameters<typeof pressureRowsFromCases>[0]),
    prisma.referenceVerifier.count().catch(() => 0),
    prismaRead.delegatedIssuer
      .count({ where: { status: "active", NOT: { slug: { startsWith: "sandbox." } } } })
      .catch(() => 0),
    prismaRead.user
      .count({
        where: {
          OR: [{ partnerRef: { not: null } }, { referredById: { not: null } }],
        },
      })
      .catch(() => 0),
    prismaRead.case.count({ where: { status: "SAVED" } }).catch(() => 0),
    prismaRead.strategyOutcome
      .groupBy({
        by: ["market"],
        where: { selfReported: false },
        _count: { _all: true },
      })
      .catch(() => [] as { market: string; _count: { _all: number } }[]),
  ]);

  const pressure = disclosedInboundPressure(aggregateInboundPressure(pressureRowsFromCases(cases)));
  const inboundInstitutionsOverThreshold = pressure.filter((p) => p.dispatchedCases >= 50).length;

  const marketsWithCitedRights = Object.values(MARKETS).filter(
    (m) => m.pack.rights.length > 0 && m.pack.rights.every((r) => r.source.trim().length > 0),
  ).length;

  const multiMarketOutcomes = marketOutcomes.filter((m) => m._count._all > 0).length >= 2;

  const registryIssuers = countActiveNetworkIssuers();
  const issuersTotal = registryIssuers + delegatedIssuersActive;

  // Prefer live HTTP probes; local packsRoot only for offline CI — not a prod green.
  const packsCdn =
    (await probeUrlOk(`${(process.env.ZML_PACKS_CDN || "https://packs.zakai.io").replace(/\/+$/, "")}/il/index.json`)) ||
    (await probeUrlOk(`${origin.replace(/\/+$/, "")}/api/cdn/packs/il/index.json`)) ||
    (process.env.VITEST === "true" && Boolean(packsRoot()));

  const interopExternalGreen = await probeUrlOk(
    `${origin.replace(/\/+$/, "")}/api/interop?probe=1`,
  );

  return {
    interopExternalGreen,
    packsCdnLive: packsCdn,
    referenceVerifiers,
    fairnessProvidersScored: fairness.length,
    issuersTotal,
    inboundInstitutionsOverThreshold,
    marketsWithCitedRights,
    multiMarketOutcomes,
    savedCases,
    attributedSignups,
    paymentsLive: paymentsFullyLive(),
  };
}

export async function loadTrillionGatesReport(origin: string) {
  return singleflight(`trillion-gates:${origin}`, 120_000, async () => {
    const inputs = await loadGateInputs(origin);
    return {
      ...evaluateTrillionGates(inputs),
      assessedAt: new Date().toISOString(),
      inputs,
    };
  });
}
