import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { badRequest } from "@/lib/api";
import { reportError } from "@/lib/report-error";

const schema = z.object({
  message: z.string().trim().min(3).max(2000),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  context: z.string().trim().max(200).optional().default(""),
});

const FEEDBACK_EMAIL =
  process.env.FEEDBACK_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "feedback@zakai.example";

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

    return NextResponse.json({ ok: true });
  } catch (err) {
    await reportError(err, { route: "feedback" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
