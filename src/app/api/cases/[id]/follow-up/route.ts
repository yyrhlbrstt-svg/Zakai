import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { type ProviderReplyKind } from "@/lib/negotiation";
import { buildFollowUpForVertical } from "@/lib/followUpRouter";
import { providerHebrewName } from "@/lib/providers";
import { agorotToShekels } from "@/lib/money";
import { rateLimit } from "@/lib/ratelimit";
import {
  dispatchCaseFollowUp,
  MAX_AGENT_ROUNDS,
  AGENT_SUBJECT_PREFIX,
} from "@/lib/services/agentFollowUp";

const schema = z.object({
  replyKind: z.enum([
    "refused",
    "too_low",
    "delay",
    "asked_call",
    "accepted",
    "competitor",
    "other",
  ]),
  round: z.number().int().min(2).max(8).optional(),
  competitorName: z.string().max(80).optional(),
  competitorPriceShekels: z.number().min(0).max(100000).optional(),
  /** When true — dispatch via Zakai Outbox with Mandate (HITL). */
  send: z.boolean().optional(),
});

/**
 * Generate (and optionally send) the next negotiation message for a SENT case.
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

  const priorRounds = await prisma.outbox.count({
    where: {
      caseId: id,
      channel: "EMAIL",
      providerMessageId: { not: "inbound" },
      subject: { startsWith: AGENT_SUBJECT_PREFIX },
    },
  });
  if (priorRounds >= MAX_AGENT_ROUNDS) {
    return NextResponse.json(
      {
        error: "MAX_ROUNDS",
        round: priorRounds,
        tip: "Written rounds exhausted — record SavingsProof, mark no change, or pivot. Do not draft another delay.",
      },
      { status: 409 },
    );
  }
  const nextRound = Math.min(
    MAX_AGENT_ROUNDS,
    parsed.data.round ?? priorRounds + 2,
  );

  if (parsed.data.send) {
    if (kase.status !== "SENT") {
      return NextResponse.json({ error: "NOT_SENT" }, { status: 409 });
    }
    const result = await dispatchCaseFollowUp(id, {
      replyKind: parsed.data.replyKind as ProviderReplyKind,
      round: nextRound,
      competitorName: parsed.data.competitorName,
      competitorPriceShekels: parsed.data.competitorPriceShekels,
      notifyUser: true,
      autoSubjectPrefix: true,
    });
    if (!result.sent) {
      const status =
        result.reason === "NEEDS_OUTREACH_EMAIL"
          ? 400
          : result.reason === "OUTREACH_DELIVERY_FAILED"
            ? 502
            : result.reason === "MAX_ROUNDS"
              ? 409
              : 409;
      return NextResponse.json(
        {
          error: result.reason ?? "send_failed",
          body: result.body,
          tip: result.tip,
          round: result.round,
        },
        { status },
      );
    }
    return NextResponse.json({
      sent: true,
      delivered: result.reason !== "QUEUED",
      round: result.round,
      subject: result.subject,
      body: result.body,
      tip: result.tip,
    });
  }

  const result = buildFollowUpForVertical(kase.vertical, {
    customerName: kase.user.name,
    providerLabel: providerHebrewName(kase.provider),
    amountOriginalShekels: agorotToShekels(kase.amountOriginal),
    targetShekels: agorotToShekels(kase.targetAmount),
    plan: kase.planDescription || undefined,
    replyKind: parsed.data.replyKind as ProviderReplyKind,
    round: nextRound,
    competitorName: parsed.data.competitorName,
    competitorPriceShekels: parsed.data.competitorPriceShekels,
  });

  return NextResponse.json({ ...result, round: nextRound, sent: false });
}
