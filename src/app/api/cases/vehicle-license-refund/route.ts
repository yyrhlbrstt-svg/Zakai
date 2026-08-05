import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { createExpressVerticalCase } from "@/lib/services/expressVerticalCase";
import { buildVehicleLicenseRefundLetter } from "@/lib/vehicleLicenseRefundLetter";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  licensePlate: z.string().max(20).default(""),
  contactEmail: z.string().email().max(120).optional(),
  reason: z.enum(["cancelled", "total_loss"]),
  cancellationDate: z.string().min(1).max(40),
  annualFeeShekels: z.number().min(0).max(20_000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-vehicle-license-refund", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const letter = buildVehicleLicenseRefundLetter({
    customerName: data.customerName,
    licensePlate: data.licensePlate,
    reason: data.reason,
    cancellationDate: data.cancellationDate,
    annualFeeShekels: data.annualFeeShekels,
  });

  const amount = data.annualFeeShekels && data.annualFeeShekels > 0 ? data.annualFeeShekels : 0;

  const result = await createExpressVerticalCase({
    userId: auth.userId,
    vertical: "vehicle-license-refund",
    provider: "משרד התחבורה — אגף הרישוי",
    counterpartyEmailCandidates: [data.contactEmail],
    amountShekels: amount,
    targetShekels: 0,
    planDescription: data.licensePlate || "החזר אגרת רישוי",
    strategy: "בקשת החזר יחסי אגרת רישוי עם Mandate",
    letter,
    beneficiaryLabel: data.customerName || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
