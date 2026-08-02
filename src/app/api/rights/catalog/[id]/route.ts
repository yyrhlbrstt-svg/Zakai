import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { findZmlRight } from "@/lib/protocol/zml/catalog";

export const runtime = "nodejs";
export const revalidate = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ip = clientIp(request);
  const limited = await rateLimit("rights-catalog", ip, 60, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const { id } = await context.params;
  const origin = new URL(request.url).origin;
  const full = new URL(request.url).searchParams.get("full") === "1";
  const right = await findZmlRight(origin, decodeURIComponent(id));
  if (!right) {
    return NextResponse.json({ error: "not_found", id }, { status: 404, headers: CORS });
  }

  if (!full) {
    return NextResponse.json(
      {
        id: right.id,
        market: right.market,
        zml_version: right.zml_version,
        message: "Pass ?full=1 for the complete ZML document",
        _links: { full: `/api/rights/catalog/${right.id}?full=1` },
      },
      { headers: CORS },
    );
  }

  return NextResponse.json(right, { headers: CORS });
}
