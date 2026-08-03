import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildCarInsuranceRefundLetter } from "@/lib/carInsuranceRefund";
import { rateLimit } from "@/lib/ratelimit";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { formatCaseDraft } from "@/lib/caseDraft";
import { resolveInsuranceContactEmail } from "@/lib/utilityContacts";

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
    firstOutreachEmail(data.contactEmail) ?? resolveInsuranceContactEmail(data.insurer);
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
      draftMessage: formatCaseDraft(letter.subject, letter.body, user.country),
      vertical: "car-insurance-refund",
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
    subject: letter.subject,
    body: letter.body,
    status: kase.status,
    message: "case_opened",
    outreachEmail: outreachTo,
  });
}
