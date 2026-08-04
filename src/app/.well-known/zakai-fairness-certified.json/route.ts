import { NextResponse } from "next/server";
import { buildFairnessCertifiedDocument } from "@/lib/monopoly/fairnessCertified";
import { loadFairnessScores } from "@/lib/services/fairnessScores";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const market = new URL(request.url).searchParams.get("market") ?? "IL";
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
