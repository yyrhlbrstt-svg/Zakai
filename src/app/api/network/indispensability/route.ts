import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { loadIndispensabilityReport } from "@/lib/services/indispensability";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": cacheControlHeader("live_aggregate"),
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** One pane: gravity + rails + gates — not a valuation. */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("indispensability", ip, 30, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  try {
    const origin = new URL(request.url).origin;
    const report = await loadIndispensabilityReport(origin);
    return NextResponse.json(report, { headers: CORS });
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 503, headers: CORS });
  }
}
