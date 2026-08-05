import { NextResponse } from "next/server";
import { buildFairnessCertifiedDocument } from "@/lib/monopoly/fairnessCertified";
import { loadFairnessScores } from "@/lib/services/fairnessScores";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 120;

/** Partner-facing Fairness Certified package + live MIN_SAMPLE providers only. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const market = (url.searchParams.get("market") ?? "IL").toUpperCase();
  let scores: Awaited<ReturnType<typeof loadFairnessScores>> = [];
  try {
    scores = await loadFairnessScores(market);
  } catch {
    scores = [];
  }
  return NextResponse.json(buildFairnessCertifiedDocument(origin, { market, scores }), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": cacheControlHeader("catalog"),
    },
  });
}
