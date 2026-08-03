import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { collectiveIntentBodySchema } from "@/lib/collective/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** Record anonymous demand signal (no account, no PII). */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await rateLimit("collective-intent", ip, 20, 3600);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate_limited", retry_after_seconds: 3600 },
      { status: 429, headers: CORS },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = collectiveIntentBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 400, headers: CORS });
  }

  const { market, vertical } = parsed.data;

  await prisma.collectiveIntentSignal.create({
    data: { market, vertical },
  });

  return NextResponse.json(
    {
      ok: true,
      disclaimer:
        "Anonymous signal only — not an offer, contract, or insurance quote. Aggregates may be published.",
    },
    { status: 201, headers: CORS },
  );
}
