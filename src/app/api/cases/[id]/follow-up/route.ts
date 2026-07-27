import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { buildFollowUp, type ProviderReplyKind } from "@/lib/negotiation";
import { providerHebrewName } from "@/lib/providers";
import { agorotToShekels } from "@/lib/money";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  replyKind: z.enum(["refused", "too_low", "delay", "asked_call", "accepted", "other"]),
  round: z.number().int().min(2).max(8).optional(),
});

/**
 * Generate the next negotiation message for a SENT case.
 * Deterministic playbooks — works without AI keys; no human agent required.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("case-followup", auth.userId, 60, 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const kase = await prisma.case.findFirst({
    where: { id, userId: auth.userId },
    include: { user: { select: { name: true } } },
  });
  if (!kase) return badRequest("genericError", 404);
  if (kase.status !== "SENT" && kase.status !== "VERIFIED" && kase.status !== "APPROVED") {
    return badRequest("genericError", 409);
  }

  const result = buildFollowUp({
    customerName: kase.user.name,
    providerLabel: providerHebrewName(kase.provider),
    amountOriginalShekels: agorotToShekels(kase.amountOriginal),
    targetShekels: agorotToShekels(kase.targetAmount),
    plan: kase.plan || undefined,
    replyKind: parsed.data.replyKind as ProviderReplyKind,
    round: parsed.data.round,
  });

  return NextResponse.json(result);
}
