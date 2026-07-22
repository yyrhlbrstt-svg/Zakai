import { NextResponse } from "next/server";
import { confirmFeePayment } from "@/lib/services/payments";
import { reportError } from "@/lib/report-error";

/**
 * PSP return / webhook. The mock provider redirects the payer here with the
 * fee id + reference; a real PSP posts a signed webhook (verify the signature
 * inside the adapter before calling confirmFeePayment). On success we flip the
 * fee to PAID and send the payer back to their dashboard.
 *
 * GET handles the browser return (mock + most hosted-page redirects); POST
 * handles server-to-server webhooks.
 */
async function handle(feeId: string | null, ref: string | null, redirect: boolean, origin: string) {
  if (!feeId || !ref) {
    return NextResponse.json({ ok: false, error: "missing params" }, { status: 400 });
  }
  try {
    const ok = await confirmFeePayment(feeId, ref);
    if (redirect) {
      const to = new URL("/he/dashboard", origin);
      to.searchParams.set("fee", ok ? "paid" : "error");
      return NextResponse.redirect(to);
    }
    return NextResponse.json({ ok });
  } catch (err) {
    await reportError(err, { route: "payments-callback" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handle(url.searchParams.get("feeId"), url.searchParams.get("ref"), true, url.origin);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}) as Record<string, unknown>);
  const feeId = (body.feeId as string) ?? url.searchParams.get("feeId");
  const ref = (body.ref as string) ?? url.searchParams.get("ref");
  return handle(feeId, ref, false, url.origin);
}
