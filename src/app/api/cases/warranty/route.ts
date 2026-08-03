import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { rateLimit } from "@/lib/ratelimit";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { formatCaseDraft } from "@/lib/caseDraft";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  seller: z.string().min(1).max(80),
  sellerEmail: z.string().max(120).optional(),
  product: z.string().min(1).max(120),
  fault: z.string().min(3).max(500),
  repairCostShekels: z.number().min(0).max(100_000).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-warranty", auth.userId, 15, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  // Soft-open: never invent an inbox and never block case+Mandate when empty.
  const outreachTo = firstOutreachEmail(data.sellerEmail) || undefined;

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  const name = data.customerName || user.name || "הלקוח/ה";
  const amount = data.repairCostShekels && data.repairCostShekels > 0 ? data.repairCostShekels : 500;

  const letterBody = `לכבוד שירות הלקוחות,
${data.seller}

הנדון: מימוש אחריות — ${data.product}

שמי ${name}. רכשתי את המוצר שבנדון, והוא עדיין בתקופת האחריות.

תיאור התקלה: ${data.fault}

בהתאם לחוק הגנת הצרכן, אני מבקש/ת לממש את האחריות ולתקן את התקלה ללא תשלום. אם לא ניתן לתקן בתוך זמן סביר — להחליף במוצר תקין או לזכות אותי, לפי העניין.

אבקש תשובה בכתב בתוך זמן סביר ולתאם מסירה/איסוף לתיקון.

בברכה,
${name}
(המכתב נוסח בסיוע זכאי — zakai)`;

  const subject = `מימוש אחריות — ${data.product}`;

  const stance = await chooseStance({
    market: "IL",
    vertical: "warranty",
    counterparty: data.seller.slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const drafted = { subject, body: letterBody };
  const staged = variant ? applyStance(drafted, variant) : drafted;
  const stanceApplied = variant !== undefined && stanceAffects(drafted, variant);

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.seller.slice(0, 80),
      amountShekels: amount,
      plan: data.product.slice(0, 120),
      strategy: "מימוש אחריות מוצר עם Mandate",
      targetShekels: 0,
      draftMessage: formatCaseDraft(staged.subject, staged.body, user.country),
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "warranty",
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

  return NextResponse.json({
    caseId: kase.id,
    subject: staged.subject,
    body: staged.body,
    status: kase.status,
    message: "case_opened",
    needsOutreachEmail: !outreachTo,
  });
}
