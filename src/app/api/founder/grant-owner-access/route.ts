import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/user";
import { isAdminEmail } from "@/lib/ops/internalAdminGate";
import { isEmailVerified } from "@/lib/services/emailVerification";

export const dynamic = "force-dynamic";

/**
 * The clickable form of scripts/grant-owner-access.mjs, for a founder who
 * has ADMIN_EMAIL set and a verified session but no terminal access to
 * production. Same three gates /founder itself already enforces (logged in,
 * ADMIN_EMAIL match, verified email) — this route grants nothing a person
 * couldn't already prove by reaching that page.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "mustLogin" }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await isEmailVerified(user.id))) {
    return NextResponse.json({ error: "emailNotVerified" }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { plan: "BUSINESS", planChangedAt: new Date(), planUntil: null },
  });

  return NextResponse.json({ ok: true, plan: updated.plan });
}
