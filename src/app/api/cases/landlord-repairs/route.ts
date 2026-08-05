import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { createExpressVerticalCase } from "@/lib/services/expressVerticalCase";
import { buildLandlordRepairLetter } from "@/lib/landlordRepairLetter";

const schema = z.object({
  tenantName: z.string().max(80).default(""),
  landlordName: z.string().min(1).max(120),
  landlordEmail: z.string().email().max(120).optional(),
  propertyAddress: z.string().min(1).max(200),
  defectDescription: z.string().min(3).max(500),
  daysSinceReported: z.number().min(0).max(3650).optional(),
  estimatedRepairCostShekels: z.number().min(0).max(200_000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-landlord-repairs", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const letter = buildLandlordRepairLetter({
    tenantName: data.tenantName,
    landlordName: data.landlordName,
    propertyAddress: data.propertyAddress,
    defectDescription: data.defectDescription,
    daysSinceReported: data.daysSinceReported,
    estimatedRepairCostShekels: data.estimatedRepairCostShekels,
  });

  // A demand for ACTION, not a refund — 0 is honest when the tenant hasn't
  // paid for the repair themselves yet.
  const amount =
    data.estimatedRepairCostShekels && data.estimatedRepairCostShekels > 0
      ? data.estimatedRepairCostShekels
      : 0;

  const result = await createExpressVerticalCase({
    userId: auth.userId,
    vertical: "landlord-repairs",
    provider: data.landlordName,
    counterpartyEmailCandidates: [data.landlordEmail],
    amountShekels: amount,
    targetShekels: 0,
    planDescription: data.propertyAddress,
    strategy: "דרישת תיקון ליקוי מול המשכיר עם Mandate",
    letter,
    beneficiaryLabel: data.tenantName || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
