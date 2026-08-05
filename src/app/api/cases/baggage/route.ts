import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { createExpressVerticalCase } from "@/lib/services/expressVerticalCase";
import { buildBaggageClaimLetter } from "@/lib/baggageLetter";
import { resolveAirlineContactEmail } from "@/lib/airlineContacts";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  airline: z.string().min(1).max(120),
  airlineContactEmail: z.string().email().max(120).optional(),
  pirNumber: z.string().max(40).default(""),
  flightDate: z.string().max(40).default(""),
  disruptionType: z.enum(["delayed", "lost"]),
  essentialPurchasesShekels: z.number().min(0).max(50_000).optional(),
  description: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-baggage", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const letter = buildBaggageClaimLetter({
    customerName: data.customerName,
    airline: data.airline,
    pirNumber: data.pirNumber,
    flightDate: data.flightDate,
    disruptionType: data.disruptionType,
    essentialPurchasesShekels: data.essentialPurchasesShekels,
    description: data.description,
  });

  // Essential-purchase receipts are the real claim amount; 0 when the user
  // hasn't spent anything yet is honest — never invent a figure to fill it.
  const amount =
    data.essentialPurchasesShekels && data.essentialPurchasesShekels > 0
      ? data.essentialPurchasesShekels
      : 0;

  const result = await createExpressVerticalCase({
    userId: auth.userId,
    vertical: "baggage",
    provider: data.airline,
    counterpartyEmailCandidates: [
      data.airlineContactEmail,
      resolveAirlineContactEmail(data.airline),
    ],
    amountShekels: amount,
    targetShekels: 0,
    planDescription: `כבודה ${data.disruptionType === "lost" ? "אבודה" : "מעוכבת"} — PIR ${data.pirNumber || "—"}`,
    strategy: "תביעת פיצוי כבודה (אמנת מונטריאול) עם Mandate",
    letter,
    beneficiaryLabel: data.customerName || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
