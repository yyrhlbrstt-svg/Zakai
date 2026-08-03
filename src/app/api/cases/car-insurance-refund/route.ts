import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildCarInsuranceRefundLetter } from "@/lib/carInsuranceRefund";
import { rateLimit } from "@/lib/ratelimit";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { expressOpenBody, tryExpressMandateSend } from "@/lib/services/expressCaseOpen";
import { formatCaseDraft } from "@/lib/caseDraft";
import { resolveInsuranceContactEmail } from "@/lib/utilityContacts";
import { stageLetterWithStance } from "@/lib/strategy/stageLetter";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  insurer: z.string().min(1).max(120),
  contactEmail: z.string().max(120).optional(),
  policyNumber: z.string().max(80).optional(),
  vehicle: z.string().max(120).optional(),
  cancelReason: z.string().max(500).optional(),
  premiumPaidShekels: z.number().min(0).max(500000).optional(),
  unusedMonths: z.number().min(0).max(24).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-car-ins-refund", auth.userId, 20, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const outreachTo =
    firstOutreachEmail(
      data.contactEmail,
      resolveInsuranceContactEmail(data.insurer),
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

  const letter = buildCarInsuranceRefundLetter({
    customerName: data.customerName || user.name || "",
    insurer: data.insurer,
    policyNumber: data.policyNumber,
    vehicle: data.vehicle,
    cancelReason: data.cancelReason,
    premiumPaidShekels: data.premiumPaidShekels,
    unusedMonths: data.unusedMonths,
  });
  const staged = await stageLetterWithStance(
    { subject: letter.subject, body: letter.body },
    { vertical: "car-insurance-refund", counterparty: data.insurer },
  );

  const amount =
    data.premiumPaidShekels && data.premiumPaidShekels > 0
      ? Math.round(data.premiumPaidShekels)
      : 500;

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.insurer.slice(0, 80),
      amountShekels: amount,
      plan: data.policyNumber || data.vehicle || "ביטוח רכב",
      strategy: "החזר פרמיה יחסי — ביטול פוליסת רכב עם Mandate",
      targetShekels: 0,
      draftMessage: formatCaseDraft(
        staged.letter.subject,
        staged.letter.body,
        user.country,
      ),
      vertical: "car-insurance-refund",
      beneficiaryLabel: data.customerName || undefined,
      counterpartyEmail: outreachTo,
      strategyVariant: staged.strategyVariant,
      strategySeed: staged.strategySeed,
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
        outreachEmail: outreachTo,
      },
    }),
  );
}
