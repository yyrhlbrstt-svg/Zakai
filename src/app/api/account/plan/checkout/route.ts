import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { rateLimit } from "@/lib/ratelimit";
import { startPlanPurchase } from "@/lib/services/planOrders";
import { SITE_URL } from "@/lib/seo";

/**
 * Buy a plan.
 *
 * The counterpart to `POST /api/account/plan`, which grants a tier and refuses
 * every paid one with 402. This is what was missing behind that refusal.
 *
 * Returns 503 when no real PSP is configured rather than falling through to the
 * mock. The mock proves the plumbing in development, but a production build
 * without `PAYMENT_PROVIDER` would otherwise hand somebody a checkout that
 * grants a paid plan and moves no money — telling them they bought something
 * they did not.
 */
const schema = z.object({
  plan: z.string().trim().min(1).max(20),
  months: z.number().int().min(1).max(12).default(1),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("plan-checkout", auth.userId, 10, 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const result = await startPlanPurchase(
    auth.userId,
    parsed.data.plan,
    parsed.data.months,
    `${SITE_URL}/api/payments/callback`,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ checkoutUrl: result.checkoutUrl, orderId: result.orderId });
}
