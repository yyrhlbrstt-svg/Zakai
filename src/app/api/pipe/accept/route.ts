import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { acceptMandateOnPipe } from "@/lib/pipe/acceptMandate";
import type { RevocationState } from "@/lib/mandate/decision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const schema = z.object({
  mandate_jws: z.string().min(20).max(16_384),
  action: z.string().min(1).max(120),
  subject: z.string().max(200).optional(),
  market: z.string().max(8).optional(),
  actConfirmation: z.string().max(500).optional(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Institution entry to the pipe — one POST.
 * Body: { mandate_jws, action } (audience extracted from the token).
 */
export async function POST(req: Request) {
  const limited = await rateLimit("pipe-accept", clientIp(req), 120, 60);
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: CORS });
  }

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "missing_fields", need: ["mandate_jws", "action"] },
      { status: 400, headers: CORS },
    );
  }

  const result = await acceptMandateOnPipe({
    mandateJws: parsed.data.mandate_jws,
    action: parsed.data.action,
    subject: parsed.data.subject,
    market: parsed.data.market,
    actConfirmation: parsed.data.actConfirmation,
    lookupRevocation: async (jti): Promise<RevocationState> => {
      try {
        const row = await prisma.mandateRevocation.findUnique({
          where: { jti },
          select: { jti: true },
        });
        return row ? "revoked" : "active";
      } catch {
        return "unknown";
      }
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, need: result.need, detail: result.detail },
      { status: result.status, headers: CORS },
    );
  }

  return NextResponse.json(
    {
      pipe: "zakai-pipe",
      ...result,
    },
    { status: 200, headers: CORS },
  );
}
