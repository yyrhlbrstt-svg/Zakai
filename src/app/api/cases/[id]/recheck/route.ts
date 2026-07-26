import { NextResponse } from "next/server";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { generateRecommendation } from "@/lib/ai";
import { providerHebrewName } from "@/lib/providers";
import { agorotToShekels } from "@/lib/money";

/**
 * Re-open a new check for an existing saved case. The original case is kept as
 * the audit record; a fresh case captures the new bill/state so the fee model
 * remains clean (fees are per-documented-saving).
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;

  const original = await prisma.case.findUnique({
    where: { id },
    include: { savingsProof: true },
  });
  if (!original || original.userId !== auth.userId) {
    return badRequest("NOT_FOUND", 404);
  }
  if (original.status !== "SAVED" && original.status !== "NO_SAVING") {
    return badRequest("notSettled", 409);
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  const amountShekels = agorotToShekels(original.savingsProof?.newAmount ?? original.targetAmount);
  const rec = await generateRecommendation({
    providerLabel: providerHebrewName(original.provider),
    amountShekels,
    plan: original.planDescription,
    locale: "he",
    customerName: user.name,
  });

  try {
    const kase = await createCase({
      userId: auth.userId,
      provider: original.provider,
      amountShekels,
      plan: original.planDescription,
      strategy: rec.strategy,
      targetShekels: rec.targetShekels,
      marketLowShekels: rec.marketLowShekels,
      marketHighShekels: rec.marketHighShekels,
      draftMessage: rec.draftMessage,
    });

    return NextResponse.json({
      ok: true,
      newCaseId: kase.id,
      provider: original.provider,
      amountShekels,
      targetShekels: rec.targetShekels,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }
}
