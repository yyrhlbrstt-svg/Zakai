import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildCancelLetter, type CancelIntent } from "@/lib/cancelLetter";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  company: z.string().min(1).max(120),
  product: z.string().min(1).max(120),
  accountOrEmail: z.string().max(120).optional(),
  monthlyShekels: z.number().min(0).max(100000).optional(),
  intent: z.enum(["cancel", "retention", "downgrade", "pause"]),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-cancel", auth.userId, 20, 24 * 3600);
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

  const letter = buildCancelLetter({
    customerName: data.customerName || user.name || "",
    company: data.company,
    product: data.product,
    accountOrEmail: data.accountOrEmail,
    monthlyShekels: data.monthlyShekels,
    intent: data.intent as CancelIntent,
    reason: data.reason,
  });

  const amount = data.monthlyShekels && data.monthlyShekels > 0 ? data.monthlyShekels : 50;
  // Cancel / pause → target 0. Retention / downgrade → ~70% of current.
  const target =
    data.intent === "cancel" || data.intent === "pause"
      ? 0
      : Math.round(amount * 0.7);

  const strategy =
    data.intent === "cancel"
      ? "ביטול מנוי מיידי עם Mandate"
      : data.intent === "retention"
        ? "בקשת שימור / התאמת מחיר"
        : data.intent === "downgrade"
          ? "הורדת מסלול"
          : "הקפאת מנוי";

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.company.slice(0, 80),
      amountShekels: amount,
      plan: data.product,
      strategy,
      targetShekels: target,
      draftMessage: `${letter.subject}\n\n${letter.body}`,
      vertical: "subscription",
      beneficiaryLabel: data.customerName || undefined,
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
    message: "case_opened",
  });
}
