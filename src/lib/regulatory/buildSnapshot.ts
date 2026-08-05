import "server-only";
import { getOutcomeGraphPublicStats } from "@/lib/protocol/discovery";
import { loadFairnessScores } from "@/lib/services/fairnessScores";
import {
  aggregateInboundPressure,
  disclosedInboundPressure,
  pressureRowsFromCases,
  CASE_PRESSURE_SELECT,
} from "@/lib/institutionInboundPressure";
import { prisma } from "@/lib/prisma";
import { MIN_SAMPLE } from "@/lib/companyScore";
import {
  REGULATORY_SNAPSHOT_CHANGELOG,
  REGULATORY_SNAPSHOT_SCHEMA,
  REGULATORY_SNAPSHOT_VERSION,
} from "@/lib/regulatory/snapshotSchema";

/**
 * Shared aggregate builder for the regulatory snapshot — used by both the
 * machine-readable API (JSON/brief/md) and the human-readable print page,
 * so the two can never silently drift into showing different numbers.
 */
export async function buildRegulatorySnapshot(market: string) {
  const [outcome, fairness, cases] = await Promise.all([
    getOutcomeGraphPublicStats(),
    loadFairnessScores(market),
    prisma.case
      .findMany({
        where: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } },
        select: CASE_PRESSURE_SELECT,
      })
      .catch(() => [] as Parameters<typeof pressureRowsFromCases>[0]),
  ]);

  let collectiveTotal = 0;
  try {
    const intentRows = await prisma.collectiveIntentSignal.groupBy({
      by: ["vertical"],
      where: { market },
      _count: { _all: true },
    });
    collectiveTotal = intentRows.reduce((s, r) => s + r._count._all, 0);
  } catch {
    collectiveTotal = 0;
  }

  const pressure = disclosedInboundPressure(aggregateInboundPressure(pressureRowsFromCases(cases)));
  const marketOutcomes = outcome.markets.filter((m) => m.market === market);
  const isEmpty = outcome.totalOutcomes === 0 && pressure.length === 0 && fairness.length === 0;

  return {
    schema: REGULATORY_SNAPSHOT_SCHEMA,
    schemaVersion: REGULATORY_SNAPSHOT_VERSION,
    changelog: REGULATORY_SNAPSHOT_CHANGELOG,
    market,
    disclaimer:
      "Aggregates from Zakai consumer activity and de-identified outcomes — not total market complaints or government statistics.",
    isEmpty,
    outcomeGraph: {
      totalOutcomesGlobal: outcome.totalOutcomes,
      marketSlice: marketOutcomes,
      updatedAt: outcome.updatedAt,
    },
    inboundPressure: {
      disclosedInstitutions: pressure.length,
      top: pressure.slice(0, 10),
    },
    fairnessScores: {
      providersWithScore: fairness.length,
      minObservations: MIN_SAMPLE,
    },
    collectiveIntent: {
      totalSignals: collectiveTotal,
      phase: "intent_only" as const,
    },
  };
}

export type RegulatorySnapshot = Awaited<ReturnType<typeof buildRegulatorySnapshot>>;
