import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { openLoopConflictIfAny } from "@/lib/services/expressCaseOpen";
import { createExpressVerticalCase } from "@/lib/services/expressVerticalCase";
import { buildVaadBaitLetter } from "@/lib/vaadBaitLetter";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  buildingAddress: z.string().max(160).default(""),
  contactEmail: z.string().email().max(120).optional(),
  unexplainedCharge: z.string().min(1).max(500),
  chargeAmountShekels: z.number().min(0).max(1_000_000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit("cases-vaad-bait", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const letter = buildVaadBaitLetter({
    customerName: data.customerName,
    buildingAddress: data.buildingAddress,
    unexplainedCharge: data.unexplainedCharge,
    chargeAmountShekels: data.chargeAmountShekels,
  });

  const result = await createExpressVerticalCase({
    userId: auth.userId,
    vertical: "vaad-bait",
    provider: data.buildingAddress ? `ועד בית — ${data.buildingAddress}` : "ועד בית",
    counterpartyEmailCandidates: [data.contactEmail],
    amountShekels: 0,
    targetShekels: 0,
    planDescription: data.unexplainedCharge.slice(0, 120),
    strategy: "בקשת דוחות כספיים ופירוט חיוב מוועד הבית עם Mandate",
    letter,
    beneficiaryLabel: data.customerName || undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
