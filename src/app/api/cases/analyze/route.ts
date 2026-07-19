import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  analyzeBillImage,
  generateRecommendation,
  aiAvailable,
  AiUnavailableError,
} from "@/lib/ai";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { PROVIDERS, isProviderKey, resolveProviderKey, providerHebrewName } from "@/lib/providers";

const schema = z.union([
  z.object({
    mode: z.literal("image"),
    imageBase64: z.string().min(10),
    mediaType: z.string().default("image/jpeg"),
    beneficiary: z.string().max(40).optional(),
    locale: z.string().default("he"),
  }),
  z.object({
    mode: z.literal("manual"),
    provider: z.string().min(1),
    amountShekels: z.number().positive().max(100000),
    plan: z.string().default(""),
    beneficiary: z.string().max(40).optional(),
    locale: z.string().default("he"),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");
  const data = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  // Plan allowance check up front, before any expensive AI work.
  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  let providerKey: string;
  let amountShekels: number;
  let plan: string;

  if (data.mode === "image") {
    if (!aiAvailable()) {
      // Surfaces the real reason in the host's Logs (Vercel) instead of the
      // generic user-facing message: the API key is not configured.
      console.warn(
        "[analyze] image OCR unavailable: ANTHROPIC_API_KEY is not set in this environment.",
      );
      return badRequest("aiUnavailable", 503);
    }
    try {
      const analysis = await analyzeBillImage(data.imageBase64, data.mediaType);
      if (!analysis.readable) return badRequest("readError", 422);
      providerKey = analysis.provider;
      amountShekels = analysis.amountShekels;
      plan = analysis.plan;
    } catch (err) {
      if (err instanceof AiUnavailableError) return badRequest("aiUnavailable", 503);
      return badRequest("readError", 422);
    }
  } else {
    providerKey = isProviderKey(data.provider) ? data.provider : resolveProviderKey(data.provider);
    amountShekels = data.amountShekels;
    plan = data.plan;
  }

  const providerLabelKey = PROVIDERS[providerKey as keyof typeof PROVIDERS]?.labelKey ?? "other";

  const rec = await generateRecommendation({
    providerLabel: providerHebrewName(providerKey),
    amountShekels,
    plan,
    locale: data.locale,
    customerName: user.name,
  });

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: providerKey,
      amountShekels,
      plan,
      strategy: rec.strategy,
      targetShekels: rec.targetShekels,
      marketLowShekels: rec.marketLowShekels,
      marketHighShekels: rec.marketHighShekels,
      draftMessage: rec.draftMessage,
      beneficiaryLabel: data.beneficiary,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }

  return NextResponse.json({
    caseId: kase.id,
    provider: providerKey,
    providerLabelKey,
    amountShekels,
    plan,
    strategy: rec.strategy,
    targetShekels: rec.targetShekels,
    marketLowShekels: rec.marketLowShekels,
    marketHighShekels: rec.marketHighShekels,
    draftMessage: rec.draftMessage,
    source: rec.source,
  });
}
