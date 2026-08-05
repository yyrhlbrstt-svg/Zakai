import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { loadFairnessScores } from "@/lib/services/fairnessScores";
import { MIN_SAMPLE } from "@/lib/companyScore";

export const runtime = "nodejs";
export const revalidate = 600;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=600, stale-while-revalidate=1800",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Public fairness scores (0–100) from de-identified StrategyOutcome win rates.
 * Empty until enough observations exist per provider (MIN_SAMPLE).
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("fairness-scores", ip, 60, 60);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: 60 },
      { status: 429, headers: CORS },
    );
  }

  const url = new URL(request.url);
  const market = (url.searchParams.get("market") ?? "IL").toUpperCase();

  try {
    const scores = await loadFairnessScores(market);
    return NextResponse.json(
      {
        market,
        min_observations: MIN_SAMPLE,
        disclaimer:
          "Scores are documented win rates from de-identified outcomes, not legal findings or consumer reviews.",
        providers: scores,
        updated_at: new Date().toISOString(),
      },
      { headers: CORS },
    );
  } catch {
    // Public integrators should get an empty catalog + 503, not an opaque 500
    // when the database is briefly unavailable or migrations are mid-deploy.
    return NextResponse.json(
      {
        market,
        min_observations: MIN_SAMPLE,
        disclaimer:
          "Scores are documented win rates from de-identified outcomes, not legal findings or consumer reviews.",
        providers: [],
        unavailable: true,
        updated_at: new Date().toISOString(),
      },
      { status: 503, headers: CORS },
    );
  }
}
