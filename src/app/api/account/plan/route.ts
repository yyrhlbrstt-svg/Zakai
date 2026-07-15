import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, badRequest } from "@/lib/api";
import { isPlanId } from "@/lib/plans";
import { rateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

/**
 * Switch the account's product tier. Pre-billing stage: the tier changes
 * immediately and is enforced everywhere; actual payment collection starts
 * only when a PSP is connected (see BACKLOG), and users are told so in the UI.
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
