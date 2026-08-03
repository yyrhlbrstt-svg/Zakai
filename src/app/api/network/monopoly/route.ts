import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { loadSevenRailsReport } from "@/lib/services/monopolyRails";
import { cacheControlHeader } from "@/lib/scale/publicCache";

export const runtime = "nodejs";
export const revalidate = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": cacheControlHeader("live_aggregate"),
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Public seven-rails monopoly status — real counters only. */
export async function GET(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("network-monopoly", ip, 60, 60);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: 60 },
      { status: 429, headers: CORS },
    );
  }

  try {
    const report = await loadSevenRailsReport();
    return NextResponse.json(report, { headers: CORS });
  } catch {
    return NextResponse.json(
      { unavailable: true, disclaimer: "Monopoly rails temporarily unavailable." },
      { status: 503, headers: CORS },
    );
  }
}
