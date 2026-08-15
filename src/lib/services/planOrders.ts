import "server-only";
import { prisma } from "@/lib/prisma";
import { planConfig, isPlanId, type PlanId } from "@/lib/plans";
import { paymentProvider, realPaymentsConfigured, PaymentUnavailableError } from "@/lib/payments";

/**
 * Selling a plan.
 *
 * WHY THIS IS A SEPARATE LINE FROM THE SUCCESS FEE
 *
 * A `Fee` is one-to-one with a Case and settles a documented saving. Reaching
 * one requires a verified owner, a sent letter and a confirmed recovery — a
 * chain that is currently broken at its first link, because without SMTP no
 * ownership can be verified, so no case can be SENT, so no SavingsProof and no
 * Fee can ever exist.
 *
 * A subscription requires none of that. It is the one revenue line in this
 * product that is not downstream of the blocked dependency, and until now it
 * had no checkout at all: `POST /api/account/plan` refused every paid upgrade
 * with 402 and there was nothing behind the refusal.
 *
 * HOW IT RIDES THE EXISTING PSP SEAM
 *
 * The payment provider takes an opaque reference and echoes it back on the
 * callback. Fees pass a fee id; this passes `plan_<orderId>`, so the shared
 * callback route can tell the two apart on a prefix and neither PSP adapter
 * needs to know this model exists. Nothing in the fee path changes, which
 * matters: it is the path that already handles real money.
 */

/** The namespace that lets one callback route serve two kinds of payment. */
export const PLAN_REF_PREFIX = "plan_";

export function planOrderIdFromRef(reference: string): string | null {
  return reference.startsWith(PLAN_REF_PREFIX)
    ? reference.slice(PLAN_REF_PREFIX.length) || null
    : null;
}

export type PlanPurchaseResult =
  | { ok: true; checkoutUrl: string; orderId: string }
  | { ok: false; error: "notPayable" | "paymentsUnavailable"; status: number };

/**
 * Start a purchase and hand back a checkout URL.
 *
 * Refuses when no real PSP is configured. The mock provider proves the
 * plumbing end to end in development, but a production build with
 * `PAYMENT_PROVIDER` unset would otherwise show a person a checkout that
 * grants them a paid plan while moving no money — which is not a demo, it is
 * giving the product away and telling them they bought it.
 */
export async function startPlanPurchase(
  userId: string,
  plan: string,
  months: number,
  returnUrl: string,
): Promise<PlanPurchaseResult> {
  if (!isPlanId(plan)) return { ok: false, error: "notPayable", status: 400 };
  const config = planConfig(plan);
  if (config.priceAgorot <= 0) return { ok: false, error: "notPayable", status: 400 };
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    return { ok: false, error: "notPayable", status: 400 };
  }
  if (!realPaymentsConfigured()) {
    return { ok: false, error: "paymentsUnavailable", status: 503 };
  }

  // Integer agorot throughout — the same rule the fee math follows, for the
  // same reason: a rounding artefact here is somebody's money.
  const amount = config.priceAgorot * months;

  const order = await prisma.planOrder.create({
    data: { userId, plan, months, amount, status: "PENDING" },
  });

  try {
    const provider = paymentProvider();
    const checkout = await provider.createCheckout({
      feeId: `${PLAN_REF_PREFIX}${order.id}`,
      amountAgorot: amount,
      description: `Zakai ${plan} — ${months} ${months === 1 ? "month" : "months"}`,
      returnUrl,
    });
    await prisma.planOrder.update({
      where: { id: order.id },
      data: { provider: provider.name, providerRef: checkout.providerRef },
    });
    return { ok: true, checkoutUrl: checkout.checkoutUrl, orderId: order.id };
  } catch (err) {
    await prisma.planOrder.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });
    if (err instanceof PaymentUnavailableError) {
      return { ok: false, error: "paymentsUnavailable", status: 503 };
    }
    throw err;
  }
}

/**
 * Confirm a paid plan and grant the period.
 *
 * Idempotent under concurrency for the same reason `confirmFeePayment` is: a
 * real PSP fires the browser bounce and the server webhook close together, both
 * carrying the same valid reference. The `updateMany` re-checks PENDING at
 * write time rather than read time, so only one of them grants the period.
 *
 * The grant extends from whichever is later — now, or an unexpired existing
 * period — so buying a second month early adds to it instead of throwing the
 * remainder away.
 */
export async function confirmPlanPayment(
  orderId: string,
  providerRef: string,
): Promise<boolean> {
  const order = await prisma.planOrder.findUnique({ where: { id: orderId } });
  if (!order) return false;
  if (order.status === "PAID") return true;
  if (!order.providerRef || order.providerRef !== providerRef) return false;

  const claimed = await prisma.planOrder.updateMany({
    where: { id: orderId, status: "PENDING", providerRef },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (claimed.count === 0) return false;

  const user = await prisma.user.findUnique({
    where: { id: order.userId },
    select: { planUntil: true },
  });
  const now = new Date();
  const from = user?.planUntil && user.planUntil > now ? user.planUntil : now;
  const until = new Date(from);
  until.setMonth(until.getMonth() + order.months);

  await prisma.user.update({
    where: { id: order.userId },
    data: { plan: order.plan as PlanId, planChangedAt: now, planUntil: until },
  });
  return true;
}

/**
 * Downgrade accounts whose paid period has ended.
 *
 * A sweep rather than a check at read time, because the plan is read in more
 * than twenty places and a rule enforced in one of them is a rule enforced
 * nowhere. It fails in the user's favour: if the sweep stops running, somebody
 * keeps a plan a little longer than they paid for, which is the right direction
 * for that error to point.
 */
export async function expireLapsedPlans(now: Date = new Date()): Promise<number> {
  const lapsed = await prisma.user.updateMany({
    where: { planUntil: { lt: now }, plan: { not: "FREE" } },
    data: { plan: "FREE", planUntil: null, planChangedAt: now },
  });
  return lapsed.count;
}
