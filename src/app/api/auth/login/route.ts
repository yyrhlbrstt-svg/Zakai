import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { burnPasswordComparison, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema, firstError } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { postAuthDestination } from "@/lib/services/postAuthDestination";
import { logSecurityEvent } from "@/lib/security/securityEvent";

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

    await logSecurityEvent({ type: "login_success", userId: user.id, ip: clientIp(request) });
    await createSession(user.id);
    const nextHref = await postAuthDestination(user.id);
    return NextResponse.json({ ok: true, nextHref });
  } catch (err) {
    await reportError(err, { route: "login" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
