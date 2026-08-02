import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { recordSaving, CaseError } from "@/lib/services/cases";
import { initiateFeePayment, PaymentError } from "@/lib/services/payments";
import { agorotToShekels } from "@/lib/money";

const schema = z.object({
  newAmountShekels: z.number().min(0).max(100000),
  locale: z.string().max(8).optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  try {
    const result = await recordSaving(id, auth.userId, parsed.data.newAmountShekels);
    const fee = result.fee;
    let checkoutUrl: string | undefined;
    if (result.feeNet > 0) {
      const origin = new URL(request.url).origin;
      try {
        const checkout = await initiateFeePayment(
          id,
          auth.userId,
          origin,
          parsed.data.locale ?? "he",
        );
        checkoutUrl = checkout.checkoutUrl;
      } catch (err) {
        if (!(err instanceof PaymentError)) throw err;
      }
    }
    return NextResponse.json({
      ok: true,
      savingMonthlyShekels: agorotToShekels(fee.savingMonthly),
      feeShekels: agorotToShekels(fee.amount),
      chargeable: fee.chargeable,
      checkoutUrl,
    });
  } catch (err) {
    if (err instanceof CaseError) {
      const status = err.message === "NOT_FOUND" ? 404 : 409;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
