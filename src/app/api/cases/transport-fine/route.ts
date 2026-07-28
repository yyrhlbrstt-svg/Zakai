import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { rateLimit } from "@/lib/ratelimit";

const REASON_BODY: Record<string, string> = {
  validator: "ניסיתי לתקף / לרכוש כרטיס אך המאמת/האפליקציה לא פעלו.",
  balance: "היה יתרה בכרטיס/ארנק אך התיקוף לא נקלט.",
  notime: "לא ניתנה הזדמנות סבירה לרכוש/לתקף לפני הביקורת.",
  details: "פרטי הדוח אינם תואמים (קו/שעה/תחנה).",
  student: "ברשותי כרטיס תלמיד/סטודנט בתוקף.",
  other: "קיימים נימוקים ענייניים לביטול הקנס.",
};

const schema = z.object({
  customerName: z.string().max(80).default(""),
  report: z.string().min(1).max(40),
  operator: z.string().min(1).max(80),
  reason: z.enum(["validator", "balance", "notime", "details", "student", "other"]),
  details: z.string().max(500).optional(),
  amountShekels: z.number().min(0).max(5000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-transport-fine", auth.userId, 15, 24 * 3600);
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
מחלקת הערעורים / קנסות, ${data.operator}

הנדון: ערעור על דו"ח קנס מספר ${data.report}

שמי ${name}, ואני מבקש/ת לערער על דו"ח הקנס שבנדון שניתן לי בגין נסיעה ללא כרטיס/תיקוף תקף.

${reasonText}${data.details ? `\n\nפירוט נוסף: ${data.details}` : ""}

לאור האמור, אבקש לבטל את הדו"ח. אם הבקשה תידחה, אבקש לקבל הנמקה מפורטת ואת פירוט זכותי להישפט או לפנות לוועדת הערר.

בכבוד רב,
${name}
(המכתב נוסח בסיוע זכאי — zakai)`;

  const subject = `ערעור על קנס תחבורה ${data.report} — ${data.operator}`;
  const amount = data.amountShekels && data.amountShekels > 0 ? data.amountShekels : 180;

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.operator.slice(0, 80),
      amountShekels: amount,
      plan: `קנס ${data.report}`,
      strategy: "ערעור קנס תחבורה ציבורית עם Mandate",
      targetShekels: 0,
      draftMessage: `${subject}\n\n${letterBody}`,
      vertical: "transport-fine",
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
