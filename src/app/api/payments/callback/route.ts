import { NextResponse } from "next/server";
import { confirmFeePayment } from "@/lib/services/payments";
import { paymentProvider, type CallbackContext } from "@/lib/payments";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

/**
 * PSP return / webhook. Security-critical: this is the only path that flips a
 * fee to PAID, so it must never trust an unauthenticated caller. The active
 * provider's `verifyCallback` authenticates the request (a real PSP verifies a
 * signature and FAILS CLOSED); only its verified {feeId, providerRef} is then
 * confirmed — and confirmFeePayment still re-checks the ref as defense in depth.
 *
 * GET handles the browser return (mock + hosted-page redirects); POST handles
 * server-to-server webhooks (the only trustworthy path for real money).
 */
function toHeaders(request: Request): Record<string, string> {
  const h: Record<string, string> = {};
  request.headers.forEach((v, k) => (h[k.toLowerCase()] = v));
  return h;
}

async function handle(ctx: CallbackContext, redirect: boolean, origin: string) {
  try {
    const verified = await paymentProvider().verifyCallback(ctx);
    if (!verified) {
      // Unauthenticated / unverifiable callback — refuse to confirm anything.
      if (redirect) {
        const to = new URL("/he/dashboard", origin);
        to.searchParams.set("fee", "error");
        return NextResponse.redirect(to);
      }
      return NextResponse.json({ ok: false, error: "unverified" }, { status: 400 });
    }
    const ok = await confirmFeePayment(verified.feeId, verified.providerRef);
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
  const limited = await rateLimit("payment-callback", clientIp(request), 20, 3600);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const url = new URL(request.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));
  return handle(
    { method: "GET", query, body: {}, rawBody: "", headers: toHeaders(request) },
    true,
    url.origin,
  );
}

export async function POST(request: Request) {
  const limited = await rateLimit("payment-callback", clientIp(request), 20, 3600);
  if (!limited.ok) return NextResponse.json({ ok: false }, { status: 429 });
  const url = new URL(request.url);
  const rawBody = await request.text();
  let body: Record<string, unknown> = {};
  try {
    body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));
  return handle(
    { method: "POST", query, body, rawBody, headers: toHeaders(request) },
    false,
    url.origin,
  );
}
