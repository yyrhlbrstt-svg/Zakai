import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { signupSchema, firstError } from "@/lib/validation";
import { normalizePhone } from "@/lib/phone";
import { generateReferralCode } from "@/lib/codes";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";
import { sendVerificationEmail } from "@/lib/services/emailVerification";

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
  const { name, email, password, phone, country, referralCode } = parsed.data;
  const normalizedPhone = normalizePhone(phone)!;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "emailTaken" }, { status: 409 });
    }

    // Resolve the invite code to a referrer, if any. Unknown codes are ignored
    // silently — a bad ?ref never blocks signup.
    let referredById: string | undefined;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });
      if (referrer) referredById = referrer.id;
    }

    // Set once at signup, never touched again — see middleware.ts's
    // capturePartnerRef for why this exists (the B2B embed channel had no
    // attribution at all before this).
    const partnerRef = (await cookies()).get("zakai_partner_ref")?.value || undefined;

    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: normalizedPhone,
        country,
        passwordHash: await hashPassword(password),
        referralCode: generateReferralCode(),
        referredById,
        partnerRef,
        // The signup form requires an explicit terms/privacy checkbox; record
        // that consent durably (Amendment 13 — documented informed consent).
        consents: { create: { purpose: "terms_privacy_v1" } },
      },
      select: { id: true },
    });

    await createSession(user.id);

    // Signed in immediately, and asked to prove the address separately.
    //
    // Blocking on a mailbox round-trip here would put friction between somebody
    // and finding out what they are owed, which is the thing this product is
    // built to remove — most of it needs no account at all. Verification gates
    // privilege instead, so the cost of an unverified address falls only where
    // it would otherwise cost somebody else something.
    //
    // A failure to send must never fail the signup: the account exists, the
    // session is live, and a link can be requested again.
    try {
      const origin = new URL(request.url).origin;
      await sendVerificationEmail(user.id, origin, country === "IL" ? "he" : "en");
    } catch (mailErr) {
      await reportError(mailErr, { route: "signup-verification-mail" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Unexpected failure — almost always a missing DATABASE_URL/AUTH_SECRET or an
    // unreachable database in a misconfigured deployment. Log it server-side and
    // return a structured error the client renders as a proper message.
    await reportError(err, { route: "signup" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
