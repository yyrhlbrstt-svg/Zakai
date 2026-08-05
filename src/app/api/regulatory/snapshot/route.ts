import { NextResponse } from "next/server";
import { MIN_SAMPLE } from "@/lib/companyScore";
import { buildRegulatorySnapshot } from "@/lib/regulatory/buildSnapshot";

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

  const snapshot = await buildRegulatorySnapshot(market);

  const payload = {
    ok: true,
    schema: snapshot.schema,
    schema_version: snapshot.schemaVersion,
    changelog: snapshot.changelog,
    market,
    disclaimer: snapshot.disclaimer,
    outcome_graph: {
      total_outcomes_global: snapshot.outcomeGraph.totalOutcomesGlobal,
      market_slice: snapshot.outcomeGraph.marketSlice,
      updated_at: snapshot.outcomeGraph.updatedAt,
    },
    inbound_pressure: {
      disclosed_institutions: snapshot.inboundPressure.disclosedInstitutions,
      top: snapshot.inboundPressure.top,
    },
    fairness_scores: {
      providers_with_score: snapshot.fairnessScores.providersWithScore,
      min_observations: MIN_SAMPLE,
    },
    collective_intent: {
      total_signals: snapshot.collectiveIntent.totalSignals,
      phase: snapshot.collectiveIntent.phase,
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
    const emptyNote = snapshot.isEmpty
      ? "\nHonesty: all aggregates are zero/empty — do not cite as market statistics.\n"
      : "";
    const top =
      snapshot.inboundPressure.top.length === 0
        ? ["  (none disclosed yet)"]
        : snapshot.inboundPressure.top.slice(0, 5).map(
            (p) =>
              `  - ${p.institutionId}: dispatched=${p.dispatchedCases} saved=${p.savedCases}`,
          );
    const lines = [
      format === "md" ? `# Zakai regulatory snapshot — ${market}` : `Zakai regulatory snapshot — ${market}`,
      `Schema: ${snapshot.schema} @ ${snapshot.schemaVersion}`,
      "",
      snapshot.disclaimer,
      emptyNote,
      `Outcome graph (global): ${snapshot.outcomeGraph.totalOutcomesGlobal}`,
      `Inbound pressure (disclosed institutions): ${snapshot.inboundPressure.disclosedInstitutions}`,
      `Fairness scores (providers): ${snapshot.fairnessScores.providersWithScore} (min n=${MIN_SAMPLE})`,
      `Collective intent signals: ${snapshot.collectiveIntent.totalSignals}`,
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
