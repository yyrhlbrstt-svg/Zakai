import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyEmailToken, sendVerificationEmail } from "@/lib/services/emailVerification";
import { getSessionUserId } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { reportError } from "@/lib/report-error";

const schema = z.object({ token: z.string().min(10).max(200) });

/** Consume a verification link. */
export async function POST(request: Request) {
  const limited = await rateLimit("verify_email", clientIp(request), 20, 900);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  try {
    const outcome = await verifyEmailToken(parsed.data.token);
    if (outcome === "ok" || outcome === "already_verified") {
      return NextResponse.json({ ok: true, outcome });
    }
    // Expired and used stay distinct from invalid: those two mean the link was
    // genuinely ours, so the honest instruction is "ask for another one" rather
    // than "that link is wrong".
    return NextResponse.json({ error: outcome }, { status: 400 });
  } catch (err) {
    await reportError(err, { route: "verify-email" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}

/**
 * Ask for another link.
 *
 * Only for the signed-in account, and never for an address supplied in the
 * request. Accepting an arbitrary address here would turn the endpoint into a
 * way to mail anybody on demand, and into a membership oracle for a service
 * whose membership is itself sensitive.
 */
export async function PUT(request: Request) {
  const limited = await rateLimit("verify_email_resend", clientIp(request), 5, 3600);
  if (!limited.ok) {
    return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });
  }

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const origin = new URL(request.url).origin;
    const locale = new URL(request.url).searchParams.get("locale") || "he";
    await sendVerificationEmail(userId, origin, locale);
    // The same answer whether a link was sent or the address was already
    // verified — there is nothing useful to learn from the difference and one
    // less thing to reason about.
    return NextResponse.json({ ok: true });
  } catch (err) {
    await reportError(err, { route: "verify-email-resend" });
    return NextResponse.json({ error: "genericError" }, { status: 500 });
  }
}
