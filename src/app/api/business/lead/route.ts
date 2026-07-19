import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/messaging";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { badRequest } from "@/lib/api";
import { reportError } from "@/lib/report-error";

const schema = z.object({
  company: z.string().trim().min(1).max(120),
  contact: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  employees: z.string().trim().max(40).optional().default(""),
  note: z.string().trim().max(1000).optional().default(""),
});

const SALES_EMAIL = process.env.SALES_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "sales@zakai.example";

/**
 * "Zakai for Employees" (B2B) lead intake. Employer HR contacts leave their
 * details; we route the lead to sales through the existing Outbox (real
 * delivery activates once SMTP is configured). IP rate-limited against spam.
 */
export async function POST(request: Request) {
  const limited = await rateLimit("business-lead", clientIp(request), 5, 3600);
  if (!limited.ok) return badRequest("tooManyRequests", 429);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const { company, contact, email, employees, note } = parsed.data;

  try {
    await sendEmail({
      to: SALES_EMAIL,
      subject: `זכאי לעובדים — פנייה חדשה: ${company}`,
      body: `פנייה חדשה מ"זכאי לעובדים":

חברה: ${company}
איש קשר: ${contact}
אימייל: ${email}
מספר עובדים: ${employees || "לא צוין"}

הערה:
${note || "—"}`,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await reportError(err, { route: "business-lead" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
