import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, badRequest } from "@/lib/api";
import { isPlanId, upgradeRequiresPayment } from "@/lib/plans";
import { rateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

/**
 * Switch the account's product tier.
 *
 * A PAID upgrade (to a higher-priced tier) may NOT be granted here — that would
 * hand out Pro/Max (a lower success fee and higher limits) for free, making
 * subscription revenue impossible. Upgrades must go through checkout and only
 * take effect on a verified payment. This endpoint therefore performs only
 * free, immediate switches: a downgrade (…→ FREE) or a same-tier no-op.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("plan-change", auth.userId, 10, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const plan = body?.plan;
  if (typeof plan !== "string" || !isPlanId(plan)) return badRequest("genericError");

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { plan: true },
    });

    // The critical guard: never grant a paid tier without payment.
    if (upgradeRequiresPayment(user?.plan, plan)) {
      return NextResponse.json({ error: "paymentRequired", plan }, { status: 402 });
    }

    await prisma.user.update({
      where: { id: auth.userId },
      data: { plan, planChangedAt: new Date() },
    });
    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    await reportError(err, { route: "plan-change" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
