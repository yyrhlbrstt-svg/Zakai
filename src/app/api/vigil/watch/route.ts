import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { evaluateRights, type RightsProfile } from "@/lib/rights";
import { summariseWatch } from "@/lib/vigil/watch";

export const dynamic = "force-dynamic";

/**
 * Read-side of the Vigil: the same countdown runVigil computes to decide
 * whether to send a push, available on demand so the product itself can show
 * it — not just a push notification pointing at a page that never displayed
 * the thing that triggered it.
 */
export async function GET() {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const profileRow = await prisma.userProfile.findUnique({
    where: { userId: auth.userId },
    select: { data: true },
  });
  if (!profileRow) return NextResponse.json({ hasProfile: false });

  const profile = profileRow.data as unknown as RightsProfile;
  const rights = evaluateRights(profile);
  const actedOn = (
    await prisma.case.findMany({ where: { userId: auth.userId }, select: { vertical: true } })
  ).map((c) => c.vertical);

  const summary = summariseWatch({
    profile,
    eligible: rights.matches.map((e) => ({ id: e.id, yearlyMinor: e.yearlyAgorot, oneTimeMinor: e.oneTimeAgorot })),
    actedOn,
  });

  return NextResponse.json({
    hasProfile: true,
    items: summary.items.slice(0, 5).map((i) => ({
      rightId: i.rightId,
      daysLeft: i.daysLeft,
      urgency: i.urgency,
      valueAtRiskMinor: i.valueAtRiskMinor,
      taxYear: i.taxYear ?? null,
    })),
    atRiskSoonMinor: summary.atRiskSoonMinor,
  });
}
