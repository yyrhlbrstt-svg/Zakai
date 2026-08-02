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
import { chooseStance } from "@/lib/strategy/store";
import { rateLimit } from "@/lib/ratelimit";
import { isSupportedMarket } from "@/lib/global/registry";
import { withFooter } from "@/lib/letterFooter";
import { footerLocaleForCountry } from "@/lib/caseDraft";

const MAX_IMAGE_B64 = 5_500_000;
const ALLOWED_MEDIA = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);

const schema = z.union([
  z.object({
    mode: z.literal("image"),
    imageBase64: z.string().min(10).max(MAX_IMAGE_B64),
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

  const limited = await rateLimit("cases-analyze", auth.userId, 40, 24 * 3600);
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

  let providerKey: string;
  let amountShekels: number;
  let plan: string;

  if (data.mode === "image") {
    if (!aiAvailable()) {
      console.warn(
        "[analyze] image OCR unavailable: ANTHROPIC_API_KEY is not set in this environment.",
      );
      return badRequest("aiUnavailable", 503);
    }
    const mediaType = (data.mediaType || "image/jpeg").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_MEDIA.has(mediaType)) return badRequest("genericError");
    try {
      const analysis = await analyzeBillImage(data.imageBase64, mediaType);
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
  const market = isSupportedMarket(user.country) ? user.country.toUpperCase() : "IL";

  const stance = await chooseStance({
    market,
    vertical: "telecom",
    counterparty: providerKey,
  });

  const rec = await generateRecommendation({
    providerLabel: providerHebrewName(providerKey),
    amountShekels,
    plan,
    locale: data.locale,
    customerName: user.name,
    stance: stance.instructions,
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
      draftMessage: withFooter(
        rec.draftMessage,
        footerLocaleForCountry(user.country),
      ),
      beneficiaryLabel: data.beneficiary,
      strategyVariant: stance.variantId,
      strategySeed: stance.seed,
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
