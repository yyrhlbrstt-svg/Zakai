import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { initiateFeePayment, PaymentError } from "@/lib/services/payments";
import { PaymentUnavailableError } from "@/lib/payments";
import { reportError } from "@/lib/report-error";

/**
 * Start collecting the success fee for a case the user owns. Returns a hosted
 * checkout URL to redirect the payer to. The origin is taken from the request
 * so the PSP returns the payer to the right place in every environment.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const origin = new URL(request.url).origin;

  try {
    const { checkoutUrl } = await initiateFeePayment(id, auth.userId, origin);
    return NextResponse.json({ ok: true, checkoutUrl });
  } catch (err) {
    if (err instanceof PaymentError) {
      const status = err.message === "NO_FEE" ? 404 : 409;
      return badRequest(err.message, status);
    }
    if (err instanceof PaymentUnavailableError) return badRequest("paymentUnavailable", 503);
    await reportError(err, { route: "fee-checkout" });
    return badRequest("genericError", 500);
  }
}
