import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { assessDepositReturn, buildDepositDemandLetter } from "@/lib/depositReturn";
import { shekelsToAgorot } from "@/lib/money";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  tenantName: z.string().max(80).default(""),
  landlordName: z.string().min(1).max(120),
  landlordEmail: z.string().email().max(200),
  propertyAddress: z.string().min(1).max(200),
  vacateDate: z.string().min(1).max(40),
  depositAmountShekels: z.number().min(1).max(500000),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-deposit", auth.userId, 20, 24 * 3600);
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

  const status = assessDepositReturn({ vacateDate: data.vacateDate });
  // Escalating to a Mandate-backed demand only makes sense once the 60-day
  // return deadline has actually passed — nothing overdue yet is not a case.
  if (!status || !status.isLate) return badRequest("notLateYet");

  const tenantName = data.tenantName.trim() || user.name || "";
  const letterBody = buildDepositDemandLetter({
    tenantName,
    landlordName: data.landlordName,
    propertyAddress: data.propertyAddress,
    depositAmountAgorot: shekelsToAgorot(data.depositAmountShekels),
    status,
  });

  const stance = await chooseStance({
    market: "IL",
    vertical: "deposit",
    counterparty: data.landlordName.slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const drafted = { subject: "", body: letterBody };
  const staged = variant ? applyStance(drafted, variant) : drafted;
  const stanceApplied = variant !== undefined && stanceAffects(drafted, variant);

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.landlordName.slice(0, 80),
      counterpartyEmail: data.landlordEmail,
      amountShekels: data.depositAmountShekels,
      plan: data.propertyAddress || "פיקדון שכירות",
      strategy: "דרישת השבת פיקדון שכירות עם Mandate",
      // One-shot recovery: target is full return (0 remaining), same as
      // refund-chase/late-payment.
      targetShekels: 0,
      draftMessage: staged.body,
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "deposit",
      beneficiaryLabel: tenantName || undefined,
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
  });
}
