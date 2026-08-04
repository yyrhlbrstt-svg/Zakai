import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { findZmlRightById } from "@/lib/protocol/packs/loader";
import { buildEvaluationGuide } from "@/lib/protocol/zml/evaluation-guide";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  const right = await findZmlRightById(origin, decodeURIComponent(id));

  if (!right) {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: CORS });
  }

  const guide = buildEvaluationGuide(right);
  return NextResponse.json(guide, {
    headers: {
      ...CORS,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
