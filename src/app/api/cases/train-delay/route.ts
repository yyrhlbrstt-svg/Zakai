import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { createExpressVerticalCase } from "@/lib/services/expressVerticalCase";
import { buildTrainDelayLetter } from "@/lib/trainDelayLetter";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  trainLine: z.string().max(120).default(""),
  contactEmail: z.string().email().max(120).optional(),
  travelDate: z.string().min(1).max(40),
  delayMinutes: z.number().min(0).max(1440).optional(),
  ticketPriceShekels: z.number().min(0).max(2000).optional(),
  claimedAmountShekels: z.number().min(0).max(50_000).optional(),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-train-delay", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const letter = buildTrainDelayLetter({
    customerName: data.customerName,
    trainLine: data.trainLine,
    travelDate: data.travelDate,
    delayMinutes: data.delayMinutes,
    ticketPriceShekels: data.ticketPriceShekels,
    claimedAmountShekels: data.claimedAmountShekels,
    description: data.description,
  });

  // Only the passenger's own stated claim, never an invented percentage of
  // the ticket price or a guessed operator-policy formula.
  const amount =
    data.claimedAmountShekels && data.claimedAmountShekels > 0 ? data.claimedAmountShekels : 0;

  const result = await createExpressVerticalCase({
    userId: auth.userId,
    vertical: "train-delay",
    provider: "Israel Railways",
    counterpartyEmailCandidates: [data.contactEmail],
    amountShekels: amount,
    targetShekels: 0,
    planDescription: data.trainLine || "עיכוב רכבת",
    strategy: "דרישת פיצוי עיכוב רכבת עם Mandate",
    letter,
    beneficiaryLabel: data.customerName || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
