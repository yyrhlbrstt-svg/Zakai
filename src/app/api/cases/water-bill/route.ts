import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { createExpressVerticalCase } from "@/lib/services/expressVerticalCase";
import { buildWaterBillCreditLetter } from "@/lib/waterBillLetter";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  accountNumber: z.string().max(40).default(""),
  contactEmail: z.string().email().max(120).optional(),
  repairDate: z.string().min(1).max(40),
  billAmountShekels: z.number().min(0).max(50_000).optional(),
  hasRepairProof: z.boolean().default(false),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-water-bill", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const letter = buildWaterBillCreditLetter({
    customerName: data.customerName,
    accountNumber: data.accountNumber,
    repairDate: data.repairDate,
    billAmountShekels: data.billAmountShekels,
    hasRepairProof: data.hasRepairProof,
  });

  const amount = data.billAmountShekels && data.billAmountShekels > 0 ? data.billAmountShekels : 0;

  const result = await createExpressVerticalCase({
    userId: auth.userId,
    vertical: "water-bill",
    provider: "תאגיד המים והביוב",
    counterpartyEmailCandidates: [data.contactEmail],
    amountShekels: amount,
    targetShekels: 0,
    planDescription: data.accountNumber || "הנחה בגין נזילה סמויה",
    strategy: "בקשת הנחה בגין נזילה סמויה עם Mandate",
    letter,
    beneficiaryLabel: data.customerName || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
