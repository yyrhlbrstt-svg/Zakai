import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { recordSaving, CaseError } from "@/lib/services/cases";
import { agorotToShekels } from "@/lib/money";
import { analyzePostSaveBill, aiAvailable } from "@/lib/ai";

const manualSchema = z.object({ newAmountShekels: z.number().min(0).max(100000), mode: z.literal("manual") });
const uploadSchema = z.object({
  mode: z.literal("upload"),
  imageBase64: z.string().min(10),
  mediaType: z.string().default("image/jpeg"),
});
const schema = z.union([manualSchema, uploadSchema]);

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  let newAmountShekels: number;
  let source: "manual" | "upload" | "ai_verified" = "manual";

  if (parsed.data.mode === "upload") {
    if (!aiAvailable()) return badRequest("aiUnavailable", 503);
    try {
      const analysis = await analyzePostSaveBill(parsed.data.imageBase64, parsed.data.mediaType);
      if (!analysis.readable) return badRequest("readError", 422);
      newAmountShekels = analysis.amountShekels;
      source = "ai_verified";
    } catch {
      return badRequest("readError", 422);
    }
  } else {
    newAmountShekels = parsed.data.newAmountShekels;
  }

  try {
    const { fee } = await recordSaving(id, auth.userId, newAmountShekels, source);
    return NextResponse.json({
      ok: true,
      savingMonthlyShekels: agorotToShekels(fee.savingMonthly),
      feeShekels: agorotToShekels(fee.amount),
      chargeable: fee.chargeable,
      source,
      newAmountShekels,
    });
  } catch (err) {
    if (err instanceof CaseError) {
      const status = err.message === "NOT_FOUND" ? 404 : 409;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
