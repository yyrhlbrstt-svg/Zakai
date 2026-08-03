import { salesInboundEmail } from "@/lib/contact";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
  /** Dual-track: which conversation the lead wants. */
  interest: z.enum(["employees", "mandate", "both"]).optional().default("employees"),
});

const SALES_EMAIL = salesInboundEmail();

const INTEREST_LABEL: Record<string, string> = {
  employees: "הטבת עובדים (B2B2C)",
  mandate: "Mandate / API מוסדי",
  both: "שני המסלולים",
};

/**
 * Dual-track B2B lead intake:
 * - employees → Zakai for Employees welfare benefit
 * - mandate → institutional Mandate / JWKS / embed pilot
 * - both → full platform conversation
 *
 * IP rate-limited. Delivery via Outbox (SMTP when configured).
 */
export async function POST(request: Request) {
  const limited = await rateLimit("business-lead", clientIp(request), 5, 3600);
  if (!limited.ok) return badRequest("tooManyRequests", 429);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const { company, contact, email, employees, note, interest } = parsed.data;

  const interestHe = INTEREST_LABEL[interest] || interest;

  // Persist before notifying, and never the other way round.
  //
  // This endpoint previously only sent mail. With no SMTP transport configured
  // the message goes to the Outbox and is delivered nowhere, so an institution
  // filling in the pilot form on /institutions vanished without trace — the one
  // enquiry this entire protocol exists to attract. The mail is a convenience;
  // the row is the record, and it survives a missing transport, a wrong address
  // and a bounced message alike.
  try {
    await prisma.lead.create({
      data: {
        vertical: `business:${interest}`,
        name: contact,
        email,
        company,
        note: [employees ? `גודל: ${employees}` : "", note].filter(Boolean).join("\n"),
      },
    });
  } catch (err) {
    // A failure here is worth knowing about, but it must not swallow the lead:
    // fall through and still attempt the notification.
    await reportError(err, { route: "business-lead-persist" });
  }

  try {
    await sendEmail({
      to: SALES_EMAIL,
      subject: `זכאי B2B [${interest}] — ${company}`,
      body: `פנייה חדשה מ-B2B (dual-track):

מסלול עניין: ${interestHe} (${interest})
חברה: ${company}
איש קשר: ${contact}
אימייל: ${email}
מספר עובדים / גודל: ${employees || "לא צוין"}

הערה:
${note || "—"}

—
Discovery:
· Mandate: /.well-known/zakai-mandate.json
· OpenAPI: /api/mandate/openapi.json
· Partners embed: /partners
· Institutions: /institutions`,
    });
    return NextResponse.json({ ok: true, interest });
  } catch (err) {
    await reportError(err, { route: "business-lead" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
