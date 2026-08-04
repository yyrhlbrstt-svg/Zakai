import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { expressOpenBody, openLoopConflictIfAny, tryExpressMandateSend } from "@/lib/services/expressCaseOpen";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { rateLimit } from "@/lib/ratelimit";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { formatCaseDraft } from "@/lib/caseDraft";

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
  authorityEmail: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;


  const limited = await rateLimit("cases-parking", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  // Parking without an authority inbox never reaches SENT — collect before open.
  const outreachTo = firstOutreachEmail(data.authorityEmail) || undefined;
  if (!outreachTo) {
    return NextResponse.json({ error: "needsOutreachEmail" }, { status: 400 });
  }

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

שמי זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם ${name} ובהרשאתו/ה המפורשת (Mandate). אינני הלקוח/ה עצמו/ה.

בשם הלקוח/ה אני מערער על דוח החניה שבנדון.

${reasonText}${data.details ? `\n\nפירוט נוסף: ${data.details}` : ""}

בקשה אחת: ביטול הדוח בכתב. ככל שהבקשה תידחה — הנמקה מפורטת ופירוט זכות ההישפטות בבית המשפט לעניינים מקומיים.

נא מענה בכתב בלבד.

בכבוד רב,
זכאי — סוכן דיגיטלי בשם ${name}`;

  const subject = `ערעור על דוח חניה ${data.ticket} — עיריית ${data.city}`;
  const amount = data.amountShekels && data.amountShekels > 0 ? data.amountShekels : 100;

  // Ask the Strategy Engine how to pitch this one, and actually apply it.
  // Recording a stance that did not change the letter would attribute an
  // outcome to a choice that had no effect — fabricated evidence, which is
  // worse than none because none is visibly absent.
  const stance = await chooseStance({
    market: "IL",
    vertical: "parking",
    counterparty: `עיריית ${data.city}`.slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const drafted = { subject, body: letterBody };
  const staged = variant ? applyStance(drafted, variant) : drafted;
  const stanceApplied = variant !== undefined && stanceAffects(drafted, variant);

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: `עיריית ${data.city}`.slice(0, 80),
      amountShekels: amount,
      plan: `דוח ${data.ticket}`,
      strategy: "ערעור דוח חניה עם Mandate",
      targetShekels: 0,
      draftMessage: formatCaseDraft(staged.subject, staged.body, user.country),
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "parking",
      beneficiaryLabel: data.customerName || undefined,
      counterpartyEmail: outreachTo,
      autoApprove: true,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }

  const express = await tryExpressMandateSend(kase.id, auth.userId, user.emailVerifiedAt);
  return NextResponse.json(
    expressOpenBody({
      caseId: kase.id,
      ...express,
      extra: {
        subject: staged.subject,
        body: staged.body,
        status: express.dispatched ? "SENT" : kase.status,
      },
    }),
  );
}
