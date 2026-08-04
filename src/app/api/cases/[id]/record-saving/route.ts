import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { recordSaving, CaseError } from "@/lib/services/cases";
import { initiateFeePayment, PaymentError } from "@/lib/services/payments";
import { agorotToShekels } from "@/lib/money";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";

const schema = z.object({
  newAmountShekels: z.number().min(0).max(100000),
  locale: z.string().max(8).optional(),
  source: z.enum(["manual", "inbound", "estimate"]).optional(),
  selfReported: z.boolean().optional(),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  try {
    const result = await recordSaving(id, auth.userId, parsed.data.newAmountShekels, {
      source: parsed.data.source,
      selfReported: parsed.data.selfReported,
    });
    const fee = result.fee;
    let checkoutUrl: string | undefined;
    let checkoutError: string | undefined;
    const paymentsLive = paymentsFullyLive();
    // Never mint a mock checkout URL for auto-redirect — that invents PAID theater.
    // Manual FeePayButton still works under mock for founder E2E.
    if (result.feeNet > 0 && paymentsLive) {
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
        // Surface to the client — especially MANDATE_REQUIRED (fee without Mandate bind).
        checkoutError = err.message;
      }
    }
    // Wire contract must match what was actually persisted — estimate/selfReported
    // proofs waive the fee (feeNet = 0) even when computeCaseSuccessFee would bill.
    const chargeable = result.feeNet > 0;
    return NextResponse.json({
      ok: true,
      savingMonthlyShekels: agorotToShekels(fee.savingMonthly),
      feeShekels: agorotToShekels(result.feeNet),
      chargeable,
      selfReported: parsed.data.selfReported === true,
      paymentsLive,
      checkoutUrl,
      checkoutError,
    });
  } catch (err) {
    if (err instanceof CaseError) {
      const status = err.message === "NOT_FOUND" ? 404 : 409;
      return badRequest(err.message, status);
    }
    throw err;
  }
}
