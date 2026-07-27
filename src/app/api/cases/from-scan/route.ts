import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildCancelLetter, type CancelIntent } from "@/lib/cancelLetter";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  merchant: z.string().min(1).max(120),
  product: z.string().max(120).optional(),
  monthlyShekels: z.number().min(1).max(100000),
  category: z
    .enum(["cellular", "tv_internet", "electricity", "insurance", "fitness", "digital", "other"])
    .default("other"),
  /** cancel = target 0; retention = negotiate ~30% off */
  intent: z.enum(["cancel", "retention", "downgrade", "pause"]).optional(),
});

/**
 * One-click Case from Money Hub scan.
 * Maps category → best default intent, builds letter + Mandate path,
 * returns caseId so the client can send the user straight to the dashboard.
 * autoApprove: the "open case now" click is explicit consent to the draft.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-from-scan", auth.userId, 30, 24 * 3600);
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

  // Default intent by category: digital/fitness → cancel; telecom → retention.
  const intent: CancelIntent =
    data.intent ??
    (data.category === "digital" || data.category === "fitness" || data.category === "other"
      ? "cancel"
      : "retention");

  const product = data.product?.trim() || data.merchant;
  const letter = buildCancelLetter({
    customerName: user.name || "",
    company: data.merchant,
    product,
    monthlyShekels: data.monthlyShekels,
    intent,
  });

  const amount = Math.round(data.monthlyShekels);
  const target =
    intent === "cancel" || intent === "pause" ? 0 : Math.round(amount * 0.7);

  const strategy =
    intent === "cancel"
      ? "ביטול מנוי שזוהה בסריקה — Mandate"
      : intent === "retention"
        ? "הורדת מחיר / שימור מסריקה"
        : intent === "downgrade"
          ? "הורדת מסלול מסריקה"
          : "הקפאת מנוי מסריקה";

  const vertical =
    data.category === "cellular" || data.category === "tv_internet"
      ? "telecom"
      : data.category === "electricity"
        ? "electricity"
        : data.category === "insurance"
          ? "insurance"
          : "subscription";

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.merchant.slice(0, 80),
      amountShekels: amount,
      plan: product.slice(0, 120),
      strategy,
      targetShekels: target,
      draftMessage: `${letter.subject}\n\n${letter.body}`,
      vertical,
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
    subject: letter.subject,
    body: letter.body,
    status: kase.status,
    intent,
    targetShekels: target,
    message: "case_opened_from_scan",
  });
}
