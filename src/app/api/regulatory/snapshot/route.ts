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
import {
  REGULATORY_SNAPSHOT_CHANGELOG,
  REGULATORY_SNAPSHOT_SCHEMA,
  REGULATORY_SNAPSHOT_VERSION,
} from "@/lib/regulatory/snapshotSchema";

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

  const payload = {
    ok: true,
    schema: REGULATORY_SNAPSHOT_SCHEMA,
    schema_version: REGULATORY_SNAPSHOT_VERSION,
    changelog: REGULATORY_SNAPSHOT_CHANGELOG,
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
      brief_export: `/api/regulatory/snapshot?market=${market}&format=brief`,
      markdown_export: `/api/regulatory/snapshot?market=${market}&format=md`,
      join_kit: "/api/network/join-kit",
    },
  };

  const format = url.searchParams.get("format");
  if (format === "brief" || format === "md") {
    const emptyNote =
      outcome.totalOutcomes === 0 && pressure.length === 0 && fairness.length === 0
        ? "\nHonesty: all aggregates are zero/empty — do not cite as market statistics.\n"
        : "";
    const top =
      pressure.length === 0
        ? ["  (none disclosed yet)"]
        : pressure.slice(0, 5).map(
            (p) =>
              `  - ${p.institutionId}: dispatched=${p.dispatchedCases} saved=${p.savedCases}`,
          );
    const lines = [
      format === "md" ? `# Zakai regulatory snapshot — ${market}` : `Zakai regulatory snapshot — ${market}`,
      `Schema: ${REGULATORY_SNAPSHOT_SCHEMA} @ ${REGULATORY_SNAPSHOT_VERSION}`,
      "",
      payload.disclaimer,
      emptyNote,
      `Outcome graph (global): ${outcome.totalOutcomes}`,
      `Inbound pressure (disclosed institutions): ${pressure.length}`,
      `Fairness scores (providers): ${fairness.length} (min n=${MIN_SAMPLE})`,
      `Collective intent signals: ${collectiveTotal}`,
      "",
      "Top inbound pressure (disclosed only):",
      ...top,
      "",
      `JSON: ${url.origin}/api/regulatory/snapshot?market=${market}`,
      `Join kit: ${url.origin}/api/network/join-kit`,
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        ...CORS,
        "Content-Type":
          format === "md" ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8",
        ...(format === "md"
          ? {
              "Content-Disposition": `inline; filename="zakai-regulatory-${market}.md"`,
            }
          : {}),
      },
    });
  }

  return NextResponse.json(payload, { headers: CORS });
}
