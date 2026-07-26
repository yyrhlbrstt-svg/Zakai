import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKey, requirePermission, errorResponse, handlePartnerError } from "@/lib/b2b-api";
import { partnerAnalyze } from "@/lib/services/partners";

const schema = z.object({
  provider: z.string().min(1),
  amountShekels: z.number().positive().max(100000),
  plan: z.string().optional(),
  customerName: z.string().min(1),
  locale: z.string().default("he"),
});

export async function POST(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  if (!requirePermission(auth.partner, "analyze")) {
    return errorResponse("permissionDenied", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("invalidInput", 400);

  try {
    const result = await partnerAnalyze({
      apiKeyId: auth.partner.id,
      ...parsed.data,
    });
    return NextResponse.json(result);
  } catch (err) {
    return handlePartnerError(err);
  }
}
