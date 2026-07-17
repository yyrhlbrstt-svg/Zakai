import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, badRequest } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { destroySession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

/**
 * Right to be forgotten (Amendment 13): permanently delete the account and,
 * via ON DELETE CASCADE, every case, verification, authorization, consent,
 * reward and financial record tied to it. Requires the account password —
 * a stolen session cookie alone must not be able to erase an account.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("account-delete", auth.userId, 5, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const password = body?.password;
  if (typeof password !== "string" || password.length === 0) {
    return badRequest("invalidCredentials", 400);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { passwordHash: true },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return badRequest("invalidCredentials", 403);
    }

    await prisma.user.delete({ where: { id: auth.userId } });
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    await reportError(err, { route: "account-delete" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
