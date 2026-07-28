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
  /** Dual-track: which conversation the lead wants. */
  interest: z.enum(["employees", "mandate", "both"]).optional().default("employees"),
});

const SALES_EMAIL = process.env.SALES_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "sales@zakai.example";

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
