import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { buildIntelligenceBrief } from "@/lib/intelligence/orchestrator";
import { cookies } from "next/headers";
import { resolveVisitorMarket } from "@/lib/global/marketGeo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  market: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/)
    .optional(),
  signals: z
    .object({
      cellularMonthlyAgorot: z.number().int().nonnegative().optional(),
      provider: z.string().min(1).max(40).optional(),
      monthsOnPlan: z.number().int().min(0).max(600).optional(),
      ageBand: z.enum(["18_24", "25_44", "45_66", "67_plus"]).optional(),
      children: z.number().int().min(0).max(12).optional(),
      employment: z.string().max(40).optional(),
    })
    .optional(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Context-first intelligence brief — specialist agents, no monolithic model required.
 * POST body carries optional aggregates only (not bill images).
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("intelligence-brief", ip, 30, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 400, headers: CORS });
  }

  const cookieStore = await cookies();
  const marketFallback = resolveVisitorMarket(cookieStore.get("zakai_market")?.value, undefined);
  const market = (parsed.data.market ?? marketFallback).toUpperCase();
  const signals = { market, ...parsed.data.signals };

  const brief = await buildIntelligenceBrief(signals, { marketFallback });

  return NextResponse.json(brief, { headers: CORS });
}
