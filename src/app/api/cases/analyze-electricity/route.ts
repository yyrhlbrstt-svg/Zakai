import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateElectricityRecommendation } from "@/lib/ai";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { estimatePlans } from "@/lib/electricity";
import { providerHebrewName } from "@/lib/providers";

const schema = z.object({
  amountShekels: z.number().positive().max(100000),
  profile: z.enum(["day_home", "evening_family", "ev_night", "spread"]),
  hasSmartMeter: z.boolean().default(false),
  locale: z.string().default("he"),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  const { amountShekels, profile, hasSmartMeter, locale } = parsed.data;

  // Electricity comparison is deterministic; no AI key required.
  const estimates = estimatePlans(amountShekels * 100, profile, hasSmartMeter);
  if (estimates.length === 0) {
    return badRequest("noPlans", 422);
  }

  const best = estimates[0];
  const providerLabel = providerHebrewName("iec");
  const bestPlanProvider = providerHebrewName(best.plan.providerKey);

  const rec = await generateElectricityRecommendation({
    providerLabel,
    amountShekels,
    bestPlanName: best.plan.nameKey,
    bestPlanProvider,
    estimatedMonthlySavingShekels: best.monthlySavingAgorot / 100,
    locale,
    customerName: user.name,
  });

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: "otherElectricity",
      amountShekels,
      plan: best.plan.nameKey,
      strategy: rec.strategy,
      targetShekels: rec.targetShekels,
      marketLowShekels: rec.marketLowShekels,
      marketHighShekels: rec.marketHighShekels,
      draftMessage: rec.draftMessage,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }

  return NextResponse.json({
    caseId: kase.id,
    provider: "otherElectricity",
    providerLabelKey: "otherElectricity",
    amountShekels,
    plan: best.plan.nameKey,
    strategy: rec.strategy,
    targetShekels: rec.targetShekels,
    marketLowShekels: rec.marketLowShekels,
    marketHighShekels: rec.marketHighShekels,
    draftMessage: rec.draftMessage,
    source: rec.source,
    estimates: estimates.slice(0, 3).map((e) => ({
      providerKey: e.plan.providerKey,
      nameKey: e.plan.nameKey,
      monthlySavingShekels: e.monthlySavingAgorot / 100,
      yearlySavingShekels: e.yearlySavingAgorot / 100,
      effectivePct: e.effectivePct,
    })),
  });
}
