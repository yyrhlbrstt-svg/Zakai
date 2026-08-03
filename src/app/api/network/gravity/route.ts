import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { loadNetworkGravitySnapshot } from "@/lib/services/networkGravity";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": cacheControlHeader("live_aggregate"),
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Public protocol gravity — real counters + flywheel phase (no user PII).
 */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("network-gravity", ip, 60, 60);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: 60 },
      { status: 429, headers: CORS },
    );
  }

  try {
    const snapshot = await loadNetworkGravitySnapshot();
    return NextResponse.json(snapshot, { headers: CORS });
  } catch {
    return NextResponse.json(
      {
        assessedAt: new Date().toISOString(),
        unavailable: true,
        disclaimer: "Gravity metrics temporarily unavailable.",
      },
      { status: 503, headers: CORS },
    );
  }
}
