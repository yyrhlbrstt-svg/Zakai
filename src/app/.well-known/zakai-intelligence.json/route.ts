import { NextResponse } from "next/server";
import { buildIntelligenceManifest } from "@/lib/intelligence/orchestrator";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildIntelligenceManifest(origin), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
