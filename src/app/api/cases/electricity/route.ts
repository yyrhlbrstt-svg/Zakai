import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildElectricityLetter } from "@/lib/electricityLetter";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  targetSupplier: z.string().min(1).max(120),
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
    kase = await createCase({
      userId: auth.userId,
      provider: data.targetSupplier.slice(0, 80),
      amountShekels: amount,
      plan: data.planName || "מעבר ספק חשמל",
      strategy: "מעבר ספק חשמל עם Mandate",
      targetShekels: target,
      draftMessage: `${letter.subject}\n\n${letter.body}`,
      vertical: "electricity",
      beneficiaryLabel: data.beneficiaryLabel || data.customerName || undefined,
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
  });
}
