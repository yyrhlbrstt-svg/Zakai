import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildElectricityLetter } from "@/lib/electricityLetter";
import { rateLimit } from "@/lib/ratelimit";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { expressOpenBody, tryExpressMandateSend } from "@/lib/services/expressCaseOpen";
import { resolveElectricityContactEmail } from "@/lib/utilityContacts";
import { formatCaseDraft } from "@/lib/caseDraft";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  targetSupplier: z.string().min(1).max(120),
  supplierEmail: z.string().max(120).optional(),
  planName: z.string().max(120).optional(),
  currentSupplier: z.string().max(120).optional(),
  monthlyBillShekels: z.number().min(0).max(50000).optional(),
  estimatedSavingShekels: z.number().min(0).max(20000).optional(),
  hasSmartMeter: z.boolean().optional(),
  addressCity: z.string().max(80).optional(),
  beneficiaryLabel: z.string().max(40).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-electricity", auth.userId, 20, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  // Typed inbox or known supplier — never invent; block open without a destination.
  const outreachTo =
    firstOutreachEmail(
      data.supplierEmail,
      resolveElectricityContactEmail(data.targetSupplier),
    ) || undefined;
  if (!outreachTo) {
    return NextResponse.json({ error: "needsOutreachEmail" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  const letter = buildElectricityLetter({
    customerName: data.customerName || user.name || "",
    targetSupplier: data.targetSupplier,
    planName: data.planName,
    currentSupplier: data.currentSupplier,
    monthlyBillShekels: data.monthlyBillShekels,
    estimatedSavingShekels: data.estimatedSavingShekels,
    hasSmartMeter: data.hasSmartMeter,
    addressCity: data.addressCity,
  });

  const amount =
    data.monthlyBillShekels && data.monthlyBillShekels > 0 ? data.monthlyBillShekels : 400;
  const target =
    data.estimatedSavingShekels && data.estimatedSavingShekels > 0
      ? Math.max(0, amount - data.estimatedSavingShekels)
      : Math.round(amount * 0.9);

  let kase;
  try {
    // Ask the Strategy Engine how to pitch this one, and actually apply it.
    // Recording a stance that did not change the letter would attribute an
    // outcome to a choice that had no effect — fabricated evidence, which is
    // worse than none because none is visibly absent.
    const stance = await chooseStance({
      market: "IL",
      vertical: "electricity",
      counterparty: String(data.targetSupplier).slice(0, 64),
    });
    const variant = variantById(stance.variantId);
    const staged = variant ? applyStance(letter, variant) : letter;
    const stanceApplied = variant !== undefined && stanceAffects(letter, variant);

    kase = await createCase({
      userId: auth.userId,
      provider: data.targetSupplier.slice(0, 80),
      amountShekels: amount,
      plan: data.planName || "מעבר ספק חשמל",
      strategy: "מעבר ספק חשמל עם Mandate",
      targetShekels: target,
      draftMessage: formatCaseDraft(staged.subject, staged.body, user.country),
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "electricity",
      beneficiaryLabel: data.beneficiaryLabel || data.customerName || undefined,
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
        subject: letter.subject,
        body: letter.body,
        status: express.dispatched ? "SENT" : kase.status,
      },
    }),
  );
}
