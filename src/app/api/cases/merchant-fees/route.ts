import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { createExpressVerticalCase } from "@/lib/services/expressVerticalCase";
import { buildMerchantFeeLetter } from "@/lib/merchantFeeLetter";

const schema = z.object({
  businessName: z.string().min(1).max(120),
  businessId: z.string().max(20).default(""),
  acquirer: z.string().min(1).max(80),
  merchantNumber: z.string().max(40).default(""),
  concern: z
    .enum(["rate_too_high", "terminal_rental", "monthly_minimum", "unexplained_charge", "other"])
    .default("rate_too_high"),
  currentTerms: z.string().max(300).default(""),
  monthlyTurnoverShekels: z.number().min(0).max(50_000_000).optional(),
  yearsAsCustomer: z.string().max(40).default(""),
  contactEmail: z.string().email().max(120).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-merchant-fees", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const letter = buildMerchantFeeLetter({
    businessName: data.businessName,
    businessId: data.businessId,
    acquirer: data.acquirer,
    merchantNumber: data.merchantNumber,
    concern: data.concern,
    currentTerms: data.currentTerms,
    monthlyTurnoverShekels: data.monthlyTurnoverShekels,
    yearsAsCustomer: data.yearsAsCustomer,
  });

  // No target is claimed. A clearing rate is only knowable from the acquirer's
  // own statement, so inventing an expected saving here would be exactly the
  // fabricated number this vertical is built to avoid.
  const result = await createExpressVerticalCase({
    userId: auth.userId,
    vertical: "merchant-fees",
    provider: data.acquirer,
    counterpartyEmailCandidates: [data.contactEmail],
    amountShekels: 0,
    targetShekels: 0,
    planDescription: data.merchantNumber || "עדכון תנאי סליקה",
    strategy: "בקשת פירוט עמלות בכתב והצעה מעודכנת, עם Mandate",
    letter,
    beneficiaryLabel: data.businessName || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
