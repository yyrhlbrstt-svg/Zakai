import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { createExpressVerticalCase } from "@/lib/services/expressVerticalCase";
import { buildCollectionComplaintLetter } from "@/lib/collectionComplaintLetter";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  collectorName: z.string().max(80).default(""),
  contactEmail: z.string().email().max(120).optional(),
  reason: z.enum(["harassment", "no_written_notice", "disputed_amount", "other"]),
  claimedAmountShekels: z.number().min(0).max(1_000_000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-collection-complaint", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const letter = buildCollectionComplaintLetter({
    customerName: data.customerName,
    collectorName: data.collectorName,
    reason: data.reason,
    claimedAmountShekels: data.claimedAmountShekels,
  });

  const result = await createExpressVerticalCase({
    userId: auth.userId,
    vertical: "collection-complaint",
    provider: data.collectorName || "חברת גבייה",
    counterpartyEmailCandidates: [data.contactEmail],
    amountShekels: 0,
    targetShekels: 0,
    planDescription: data.collectorName || "אימות חוב והפסקת הטרדה",
    strategy: "דרישת אימות חוב בכתב והפסקת הטרדה עם Mandate",
    letter,
    beneficiaryLabel: data.customerName || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
