import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/services/passwordReset";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { logSecurityEvent } from "@/lib/security/securityEvent";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("invalidEmail"),
  locale: z.string().max(5).default("he"),
});

export async function POST(request: Request) {
  // Tighter than login: a reset mails a third party, so abuse costs deliverability
  // reputation, not just CPU.
  const limited = await rateLimit("password_reset", clientIp(request), 5, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalidEmail" }, { status: 400 });
  }

  await logSecurityEvent({
    type: "password_reset_requested",
    ip: clientIp(request),
    detail: parsed.data.email,
  });

  try {
    const origin = new URL(request.url).origin;
    await requestPasswordReset(parsed.data.email, origin, parsed.data.locale);
  } catch (err) {
    // Deliberately swallowed for the client. Reporting a failure here would
    // tell an attacker that the address exists (only a real account reaches
    // the code path that can fail), which is exactly what the identical
    // response is designed to hide.
    await reportError(err, { route: "password/request" });
  }

  // Always the same answer, whether or not the account exists.
  return NextResponse.json({ ok: true });
}
