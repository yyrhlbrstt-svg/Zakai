import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { badRequest } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/user";
import { normalizeIsraeliMobile } from "@/lib/phone";
import { reportError } from "@/lib/report-error";

const schema = z.object({
  vertical: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(40),
  note: z.string().trim().max(1000).optional().default(""),
});

const LEADS_EMAIL =
  process.env.LEADS_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "leads@zakai.example";

/**
 * Commissionable lead intake. A user on a high-value vertical (defects, car
 * value, mortgage insurance, tax…) leaves name + phone; we store the qualified
 * lead and notify the team, then connect them to a vetted professional/service
 * and monetise via a success/referral fee. Validated, IP rate-limited, and it
 * captures the logged-in userId when there is one.
 */
export async function POST(request: Request) {
  const limited = await rateLimit("lead", clientIp(request), 6, 3600);
  if (!limited.ok) return badRequest("tooManyRequests", 429);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const { vertical, name, phone, note } = parsed.data;

  const normalizedPhone = normalizeIsraeliMobile(phone) ?? phone;
  const user = await getCurrentUser().catch(() => null);

  try {
    await prisma.lead.create({
      data: { vertical, name, phone: normalizedPhone, note, userId: user?.id ?? null },
    });

    try {
      await sendEmail({
        to: LEADS_EMAIL,
        subject: `זכאי — ליד חדש: ${vertical}`,
        body: `ליד חדש בורטיקל "${vertical}":

שם: ${name}
טלפון: ${normalizedPhone}
משתמש מחובר: ${user?.email ?? "לא"}

הערה:
${note || "—"}`,
      });
    } catch (mailErr) {
      await reportError(mailErr, { route: "lead-mail" });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    await reportError(err, { route: "lead" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
