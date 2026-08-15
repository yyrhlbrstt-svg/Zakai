import { NextResponse } from "next/server";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { expireLapsedPlans } from "@/lib/services/planOrders";

/**
 * Downgrade accounts whose paid period has ended.
 *
 * A sweep rather than a check every time the plan is read: `user.plan` is read
 * in more than twenty places, and a rule enforced in one of them is a rule
 * enforced nowhere.
 *
 * It fails in the user's favour. If this stops running, somebody keeps a plan
 * slightly longer than they paid for — the correct direction for that error to
 * point, and the opposite of silently revoking something they bought.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  const downgraded = await expireLapsedPlans();
  return NextResponse.json({ ok: true, downgraded });
}
