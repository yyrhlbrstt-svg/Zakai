import { feedbackInboundEmail } from "@/lib/contact";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { pushToUser } from "@/lib/push";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { badRequest } from "@/lib/api";
import { reportError } from "@/lib/report-error";
import { findAdminUserIds } from "@/lib/ops/internalAdminGate";

const schema = z.object({
  message: z.string().trim().min(3).max(2000),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  context: z.string().trim().max(200).optional().default(""),
});

const FEEDBACK_EMAIL = feedbackInboundEmail();

/**
 * "What would you improve in Zakai?" intake. Persists every suggestion so the
 * team can read and prioritise from real user input, and also emails it out
 * (real delivery activates once SMTP is configured). IP rate-limited so the
 * box can't be spammed. Open to logged-out visitors too.
 */
export async function POST(request: Request) {
  const limited = await rateLimit("feedback", clientIp(request), 5, 3600);
  if (!limited.ok) return badRequest("tooManyRequests", 429);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const { message, email, context } = parsed.data;

  try {
    await prisma.feedback.create({
      data: { message, email: email || null, context: context || "" },
    });

    // Best-effort notification; a mail failure must not lose the stored row.
    try {
      await sendEmail({
        to: FEEDBACK_EMAIL,
        subject: "זכאי — משוב חדש ממשתמש",
        body: `הגיע משוב חדש:

${message}

מסך: ${context || "—"}
אימייל לחזרה: ${email || "לא הושאר"}`,
      });
    } catch (mailErr) {
      await reportError(mailErr, { route: "feedback-mail" });
    }

    // Push reaches the founder's phone even when SMTP is unset — a second,
    // independent channel for the one signal that should never wait for a
    // daily digest. Best-effort: pushToUser silently no-ops without VAPID
    // keys or a subscription, same contract as every other push call site.
    try {
      const adminIds = await findAdminUserIds();
      await Promise.all(
        adminIds.map((id) =>
          pushToUser(id, {
            title: "משוב חדש בזכאי",
            body: message.slice(0, 120),
            url: "/founder",
            tag: "founder-feedback",
          }),
        ),
      );
    } catch (pushErr) {
      await reportError(pushErr, { route: "feedback-push" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    await reportError(err, { route: "feedback" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
