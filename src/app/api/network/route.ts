import { NextResponse } from "next/server";
import { buildNetworkFeed } from "@/lib/protocol/discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public read-only network state: laws, live ops flags, de-identified outcome graph totals.
 * No authentication — the moat is verifiable rules + growing evidence, not a login wall.
 */
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const body = await buildNetworkFeed(origin);
  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
