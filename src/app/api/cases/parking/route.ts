import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { rateLimit } from "@/lib/ratelimit";

const REASON_BODY: Record<string, string> = {
  signage: "השילוט במקום לא היה ברור / לא נראה / סותר.",
  machine: "מכונת התשלום הייתה מקולקלת או לא זמינה.",
  loading: "עמדתי לצורך פריקה/טעינה קצרה כמותר.",
  disabled: "ברשותי תו נכה בתוקף שהיה מוצג כנדרש.",
  details: "פרטי הדוח אינם תואמים את המציאות (מקום/שעה/רכב).",
  other: "קיימים נימוקים ענייניים לביטול הדוח.",
};

const schema = z.object({
  customerName: z.string().max(80).default(""),
  ticket: z.string().min(1).max(40),
  city: z.string().min(1).max(60),
  reason: z.enum(["signage", "machine", "loading", "disabled", "details", "other"]),
  details: z.string().max(500).optional(),
  amountShekels: z.number().min(0).max(10000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-parking", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  const name = data.customerName || user.name || "הלקוח/ה";
  const reasonText = REASON_BODY[data.reason] || REASON_BODY.other;
  const letterBody = `לכבוד
מחלקת הפיקוח / הגבייה, עיריית ${data.city}

הנדון: ערעור על דוח חניה מספר ${data.ticket}

שמי ${name}, ואני מבקש/ת לערער על דוח החניה שבנדון.

${reasonText}${data.details ? `\n\nפירוט נוסף: ${data.details}` : ""}

לאור האמור, אבקש לבטל את הדוח. ככל שהבקשה תידחה, אבקש לקבל הנמקה מפורטת ואת זכותי להישפט בבית המשפט לעניינים מקומיים.

בכבוד רב,
${name}
(המכתב נוסח בסיוע זכאי — zakai)`;

  const subject = `ערעור על דוח חניה ${data.ticket} — עיריית ${data.city}`;
  const amount = data.amountShekels && data.amountShekels > 0 ? data.amountShekels : 100;

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: `עיריית ${data.city}`.slice(0, 80),
      amountShekels: amount,
      plan: `דוח ${data.ticket}`,
      strategy: "ערעור דוח חניה עם Mandate",
      targetShekels: 0,
      draftMessage: `${subject}\n\n${letterBody}`,
      vertical: "parking",
      beneficiaryLabel: data.customerName || undefined,
      autoApprove: true,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }

  return NextResponse.json({
    caseId: kase.id,
    subject,
    body: letterBody,
    status: kase.status,
    message: "case_opened",
  });
}
