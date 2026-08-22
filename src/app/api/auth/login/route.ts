import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { burnPasswordComparison, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { postAuthDestination } from "@/lib/services/postAuthDestination";
import { logSecurityEvent } from "@/lib/security/securityEvent";
import { claimLoginAttempt, releaseLoginAttempt } from "@/lib/security/loginThrottle";

export async function POST(request: Request) {
  const limited = await rateLimit("login", clientIp(request), 10, 600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const { email, password } = parsed.data;

  /**
   * The IP limit above stops one caller. This stops one *account* being
   * guessed at from many callers, which is what password guessing actually
   * looks like. Spent before the comparison because the decision has to be
   * made before the expensive part runs; refunded below when the credentials
   * turn out to be right, so only consecutive failures accumulate.
   *
   * The refusal is deliberately the same 429 an unknown address would get:
   * a distinguishable "this account is locked" would answer the question the
   * rest of this route works hard not to.
   */
  const budget = await claimLoginAttempt(email);
  if (!budget.ok) {
    await logSecurityEvent({
      type: "login_failed",
      ip: clientIp(request),
      detail: `${email} (account throttle) — repeated failures across callers`,
    });
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Same response *and* the same cost for "no user" and "bad password".
    // Identical wording alone leaves a timing oracle: bcrypt takes ~100ms, and
    // skipping it for an address with no account makes the two cases trivially
    // distinguishable by how fast the rejection arrives.
    const ok = user
      ? await verifyPassword(password, user.passwordHash)
      : await burnPasswordComparison(password);

    if (!user || !ok) {
      await logSecurityEvent({ type: "login_failed", ip: clientIp(request), detail: email });
      return NextResponse.json({ error: "invalidCredentials" }, { status: 401 });
    }

    await releaseLoginAttempt(email);
    await logSecurityEvent({ type: "login_success", userId: user.id, ip: clientIp(request) });
    await createSession(user.id);
    const nextHref = await postAuthDestination(user.id);
    return NextResponse.json({ ok: true, nextHref });
  } catch (err) {
    await reportError(err, { route: "login" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
