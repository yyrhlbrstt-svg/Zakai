import { NextResponse } from "next/server";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300",
};

/**
 * Single pane for supervisors: de-identified outcomes + inbound pressure + fairness coverage.
 * Not legal advice or official regulatory filings.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const market = (url.searchParams.get("market") ?? "IL").toUpperCase();

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

  return NextResponse.json(
    {
      ok: true,
      market,
      disclaimer:
        "Aggregates from Zakai consumer activity and de-identified outcomes — not total market complaints or government statistics.",
      outcome_graph: {
        total_outcomes_global: outcome.totalOutcomes,
        market_slice: marketOutcomes,
        updated_at: outcome.updatedAt,
      },
      inbound_pressure: {
        disclosed_institutions: pressure.length,
        top: pressure.slice(0, 10),
      },
      fairness_scores: {
        providers_with_score: fairness.length,
        min_observations: MIN_SAMPLE,
      },
      collective_intent: {
        total_signals: collectiveTotal,
        phase: "intent_only",
      },
      links: {
        inbound_pressure: "/api/institution/inbound-pressure",
        fairness: `/api/fairness/scores?market=${market}`,
        network: "/api/network",
      },
    },
    { headers: CORS },
  );
}
