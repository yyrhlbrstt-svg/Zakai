import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { createExpressVerticalCase } from "@/lib/services/expressVerticalCase";
import { buildTollDisputeLetter } from "@/lib/tollDisputeLetter";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  invoiceNumber: z.string().max(40).default(""),
  contactEmail: z.string().email().max(120).optional(),
  reason: z.enum(["wrong_vehicle", "vehicle_sold", "duplicate", "technical_fault", "other"]),
  details: z.string().max(500).optional(),
  amountShekels: z.number().min(0).max(50_000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-toll-dispute", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const letter = buildTollDisputeLetter({
    customerName: data.customerName,
    invoiceNumber: data.invoiceNumber,
    reason: data.reason,
    details: data.details,
    amountShekels: data.amountShekels,
  });

  const amount = data.amountShekels && data.amountShekels > 0 ? data.amountShekels : 0;

  const result = await createExpressVerticalCase({
    userId: auth.userId,
    vertical: "toll-dispute",
    provider: "כביש חוצה ישראל",
    counterpartyEmailCandidates: [data.contactEmail],
    amountShekels: amount,
    targetShekels: 0,
    planDescription: data.invoiceNumber || "ערעור חיוב כביש 6",
    strategy: "ערעור חיוב כביש 6 עם Mandate",
    letter,
    beneficiaryLabel: data.customerName || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
