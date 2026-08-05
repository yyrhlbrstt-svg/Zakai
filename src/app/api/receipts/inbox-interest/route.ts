import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { recordInboxInterest } from "@/lib/services/receipts";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  provider: z.enum(["gmail", "outlook"]),
});

/**
 * Records interest in automatic inbox scanning. Never a live OAuth
 * connection — see ConnectedInboxInterest in schema.prisma for why: a real
 * connection needs a verified Google/Microsoft OAuth app, which is a
 * business step, not something this endpoint can grant.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("receipts-inbox-interest", auth.userId, 10, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  await recordInboxInterest(auth.userId, parsed.data.provider);
  return NextResponse.json({ ok: true });
}
