import { NextResponse } from "next/server";
import { confirmFeePayment } from "@/lib/services/payments";
import { confirmPlanPayment, planOrderIdFromRef } from "@/lib/services/planOrders";
import { dashboardFeeRedirectPath } from "@/lib/services/paymentRedirect";
import { browserFeeReturnWhenUnverified } from "@/lib/services/browserFeeReturn";
import { paymentProvider, type CallbackContext } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
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
  const localeHint = ctx.query.loc ?? ctx.query.locale ?? null;
  const feeIdFromQuery = ctx.query.feeId ?? (ctx.body.feeId as string | undefined);
  try {
    const verified = await paymentProvider().verifyCallback(ctx);
    if (!verified) {
      if (redirect) {
        // PayPlus GET is fail-closed by design. Never claim paid from the bounce —
        // if webhook already flipped PAID, land on share; if outcome=success, show
        // confirming; otherwise retry checkout with case deep-link.
        let feeStatus: string | null = null;
        if (feeIdFromQuery) {
          const fee = await prisma.fee.findUnique({
            where: { id: feeIdFromQuery },
            select: { status: true },
          });
          feeStatus = fee?.status ?? null;
        }
        const disposition = browserFeeReturnWhenUnverified({
          feeStatus,
          outcomeHint: ctx.query.outcome ?? null,
        });
        const path = await dashboardFeeRedirectPath(
          disposition,
          feeIdFromQuery,
          localeHint,
        );
        return NextResponse.redirect(new URL(path, origin));
      }
      return NextResponse.json({ ok: false, error: "unverified" }, { status: 400 });
    }
    /**
     * Two kinds of payment come back through this one authenticated door.
     *
     * A fee reference is a fee id; a plan purchase hands the PSP
     * `plan_<orderId>`. Splitting on the prefix here means neither PSP adapter
     * has to know that subscriptions exist, and — more importantly — the fee
     * path, which is the one already trusted with real money, is untouched.
     */
    const planOrderId = planOrderIdFromRef(verified.feeId);
    if (planOrderId) {
      const paid = await confirmPlanPayment(planOrderId, verified.providerRef);
      if (redirect) {
        const loc = localeHint || "he";
        return NextResponse.redirect(
          new URL(`/${loc}/settings?plan=${paid ? "active" : "error"}`, origin),
        );
      }
      return NextResponse.json({ ok: paid });
    }

    const ok = await confirmFeePayment(verified.feeId, verified.providerRef);
    if (redirect) {
      const path = await dashboardFeeRedirectPath(ok ? "paid" : "error", verified.feeId, localeHint);
      return NextResponse.redirect(new URL(path, origin));
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
