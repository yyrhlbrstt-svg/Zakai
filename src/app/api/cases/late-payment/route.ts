import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { assessLatePayment, buildLatePaymentDemandLetter } from "@/lib/latePaymentClaim";
import { shekelsToAgorot } from "@/lib/money";
import { rateLimit } from "@/lib/ratelimit";
import { firstOutreachEmail } from "@/lib/outreachEmail";

const schema = z.object({
  supplierName: z.string().max(80).default(""),
  clientName: z.string().min(1).max(120),
  // Soft-open: inbox optional — dashboard collects before Mandate dispatch.
  clientEmail: z.string().max(200).optional(),
  invoiceNumber: z.string().max(80).default(""),
  invoiceDate: z.string().min(1).max(40),
  agreedTermDays: z.number().min(1).max(365).optional(),
  invoiceAmountShekels: z.number().min(1).max(500000),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-late-payment", auth.userId, 20, 24 * 3600);
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

  const status = assessLatePayment({
    invoiceDate: data.invoiceDate,
    agreedTermDays: data.agreedTermDays,
  });
  // Escalating to a Mandate-backed demand only makes sense once the invoice is
  // actually overdue — nothing to collect on yet is not a case to open.
  if (!status || !status.isLate) return badRequest("notLateYet");

  const supplierName = data.supplierName.trim() || user.name || "";
  const letterBody = buildLatePaymentDemandLetter({
    supplierName,
    clientName: data.clientName,
    invoiceNumber: data.invoiceNumber.trim() || "—",
    invoiceAmountAgorot: shekelsToAgorot(data.invoiceAmountShekels),
    status,
  });

  const stance = await chooseStance({
    market: "IL",
    vertical: "late-payment",
    counterparty: data.clientName.slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const drafted = { subject: "", body: letterBody };
  const staged = variant ? applyStance(drafted, variant) : drafted;
  const stanceApplied = variant !== undefined && stanceAffects(drafted, variant);

  const outreachTo = firstOutreachEmail(data.clientEmail) || undefined;

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.clientName.slice(0, 80),
      counterpartyEmail: outreachTo,
      amountShekels: data.invoiceAmountShekels,
      plan: data.invoiceNumber || "חוב לקוח",
      strategy: "דרישת תשלום חשבונית באיחור עם Mandate",
      // One-shot recovery: target is full payment (0 remaining), same as
      // refund-chase/airline.
      targetShekels: 0,
      draftMessage: staged.body,
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "late-payment",
      beneficiaryLabel: supplierName || undefined,
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
    body: staged.body,
    status: kase.status,
    daysLate: status.daysLate,
    message: "case_opened",
    needsOutreachEmail: !outreachTo,
  });
}
