import { NextResponse } from "next/server";
import { MIN_SAMPLE } from "@/lib/companyScore";
import { buildRegulatorySnapshot } from "@/lib/regulatory/buildSnapshot";
import { SNAPSHOT_MIN_SAMPLE, signSnapshot } from "@/lib/mandate/signedSnapshot";
import { loadSnapshotFacts } from "@/lib/regulatory/snapshotFacts";

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

  // Asked for this market, not inferred from the global emptiness flag: a
  // market with three outcomes is not empty overall, and advertising a signed
  // form the signed endpoint then refuses would send a reader to a 409.
  const signableFacts = await loadSnapshotFacts(market);

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
      signed_export: `/api/regulatory/snapshot?market=${market}&format=signed`,
      jwks: "/.well-known/zakai-jwks.json",
      join_kit: "/api/network/join-kit",
    },
    /**
     * Said out loud, because a reader who quotes the JSON has no way to know
     * the checkable version exists — and the whole point of publishing one is
     * that it gets cited instead.
     */
    verifiability: {
      signed_form_available: signableFacts !== null,
      documented_outcomes_in_market: signableFacts?.sampleSize ?? 0,
      min_sample_to_sign: SNAPSHOT_MIN_SAMPLE,
      note: "The JSON above is asserted by Zakai. The signed export is a compact JWS verifiable against the published JWKS by anyone, without contacting us.",
    },
  };

  const format = url.searchParams.get("format");

  /**
   * The signed form — the difference between a page that asserts and evidence
   * that holds. Everything above is a web page a reader has to take our word
   * for; this is a compact JWS anyone can check against the published JWKS,
   * and can still check after we would have any interest in it saying
   * something else.
   *
   * It refuses rather than degrades. A snapshot with too thin a sample, or one
   * we cannot sign because no key is configured, produces an explicit failure —
   * never an unsigned document served from a URL that promised a signed one,
   * which is the one outcome that would actively mislead.
   */
  if (format === "signed") {
    const facts = signableFacts;
    if (!facts) {
      return NextResponse.json(
        {
          ok: false,
          error: "not_publishable",
          detail: `fewer than ${SNAPSHOT_MIN_SAMPLE} documented outcomes in ${market} — signing an empty aggregate would give it an authority the data has not earned`,
          min_sample: SNAPSHOT_MIN_SAMPLE,
        },
        { status: 409, headers: CORS },
      );
    }
    try {
      const jws = await signSnapshot(facts, url.origin);
      return new NextResponse(jws, {
        headers: {
          ...CORS,
          "Content-Type": "application/jwt",
          "Content-Disposition": `inline; filename="zakai-snapshot-${market}.jwt"`,
          // Where to get the key. A signature nobody can locate the key for is
          // not verifiable in practice, however sound it is in theory.
          Link: `<${url.origin}/.well-known/zakai-jwks.json>; rel="jwks"`,
        },
      });
    } catch {
      return NextResponse.json(
        { ok: false, error: "signing_unavailable", detail: "no Mandate signing key is configured" },
        { status: 503, headers: CORS },
      );
    }
  }

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
      // A reader quoting this text has no way to know a checkable version
      // exists, and the point of publishing one is that it gets cited instead.
      `Signed (verifiable JWS): ${url.origin}/api/regulatory/snapshot?market=${market}&format=signed`,
      `Verification key: ${url.origin}/.well-known/zakai-jwks.json`,
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
