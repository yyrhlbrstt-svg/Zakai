import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { signupSchema, firstError } from "@/lib/validation";
import { normalizeIsraeliMobile } from "@/lib/phone";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

export async function POST(request: Request) {
  const limited = await rateLimit("signup", clientIp(request), 10, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  }
  const { name, email, password, phone } = parsed.data;
  const normalizedPhone = normalizeIsraeliMobile(phone)!;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "emailTaken" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: normalizedPhone,
        passwordHash: await hashPassword(password),
      },
      select: { id: true },
    });

    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Unexpected failure — almost always a missing DATABASE_URL/AUTH_SECRET or an
    // unreachable database in a misconfigured deployment. Log it server-side and
    // return a structured error the client renders as a proper message.
    await reportError(err, { route: "signup" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
