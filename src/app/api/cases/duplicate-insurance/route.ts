import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { buildDuplicateInsuranceLetter } from "@/lib/duplicateInsuranceClaim";
import { agorotToShekels, shekelsToAgorot } from "@/lib/money";
import { rateLimit } from "@/lib/ratelimit";
import { firstOutreachEmail } from "@/lib/outreachEmail";

const schema = z.object({
  customerName: z.string().max(80).default(""),
  insurerName: z.string().min(1).max(120),
  // Soft-open: inbox optional — dashboard collects before Mandate dispatch.
  insurerEmail: z.string().max(200).optional(),
  wastefulPolicyKeys: z.array(z.string().min(1).max(40)).min(1).max(12),
  monthlyPremiumAgorot: z.number().int().min(100).max(500_000),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-duplicate-insurance", auth.userId, 20, 24 * 3600);
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

  const customerName = data.customerName.trim() || user.name || "";
  const letterBody = buildDuplicateInsuranceLetter({
    customerName,
    insurerName: data.insurerName,
    wastefulPolicyKeys: data.wastefulPolicyKeys,
    monthlyPremiumAgorot: data.monthlyPremiumAgorot,
  });

  const monthlyShekels = agorotToShekels(data.monthlyPremiumAgorot);
  const planLabel = data.wastefulPolicyKeys.slice(0, 3).join(", ") || "כפל ביטוחי";

  const stance = await chooseStance({
    market: "IL",
    vertical: "duplicate-insurance",
    counterparty: data.insurerName.slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const drafted = { subject: "", body: letterBody };
  const staged = variant ? applyStance(drafted, variant) : drafted;
  const stanceApplied = variant !== undefined && stanceAffects(drafted, variant);

  const outreachTo = firstOutreachEmail(data.insurerEmail) || undefined;

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: data.insurerName.slice(0, 80),
      counterpartyEmail: outreachTo,
      amountShekels: monthlyShekels,
      plan: planLabel,
      strategy: "בקשה לביטול כיסוי שיפוי כפול עם Mandate",
      targetShekels: 0,
      draftMessage: staged.body,
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: "duplicate-insurance",
      beneficiaryLabel: customerName || undefined,
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
    amountOriginalAgorot: shekelsToAgorot(monthlyShekels),
    message: "case_opened",
    needsOutreachEmail: !outreachTo,
  });
}
