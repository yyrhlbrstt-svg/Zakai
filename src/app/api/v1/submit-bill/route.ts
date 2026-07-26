import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiKey, requirePermission, errorResponse } from "@/lib/b2b-api";
import { analyzeBillImage, aiAvailable, generateRecommendation } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { createCase } from "@/lib/services/cases";
import { providerHebrewName } from "@/lib/providers";
import { reportError } from "@/lib/report-error";

const schema = z.object({
  userId: z.string().min(1),
  partnerRef: z.string().optional(),
  imageBase64: z.string().min(10),
  mediaType: z.string().default("image/jpeg"),
  customerName: z.string().min(1),
  locale: z.string().default("he"),
});

/**
 * B2B endpoint: a partner submits a bill image on behalf of an existing Zakai user.
 * We OCR the image, generate a recommendation, and optionally open a case.
 * Requires `claim` permission so the partner can act on the customer's behalf.
 */
export async function POST(request: Request) {
  const auth = await requireApiKey(request);
  if (!auth.ok) return auth.response;

  if (!requirePermission(auth.partner, "claim")) {
    return errorResponse("permissionDenied", 403);
  }

  if (!aiAvailable()) {
    return errorResponse("aiUnavailable", 503);
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorResponse("invalidInput", 400);

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, name: true, plan: true },
  });
  if (!user) return errorResponse("userNotFound", 404);

  try {
    const analysis = await analyzeBillImage(parsed.data.imageBase64, parsed.data.mediaType);
    if (!analysis.readable) {
      return NextResponse.json({ ok: false, error: "unreadableBill" }, { status: 422 });
    }

    const rec = await generateRecommendation({
      providerLabel: providerHebrewName(analysis.provider),
      amountShekels: analysis.amountShekels,
      plan: analysis.plan,
      locale: parsed.data.locale,
      customerName: parsed.data.customerName || user.name,
    });

    const kase = await createCase({
      userId: user.id,
      provider: analysis.provider,
      amountShekels: analysis.amountShekels,
      plan: analysis.plan,
      strategy: rec.strategy,
      targetShekels: rec.targetShekels,
      marketLowShekels: rec.marketLowShekels,
      marketHighShekels: rec.marketHighShekels,
      draftMessage: rec.draftMessage,
    });

    await prisma.partnerCaseLink.create({
      data: {
        partnerId: auth.partner.id,
        caseId: kase.id,
        partnerRef: parsed.data.partnerRef,
      },
    });

    return NextResponse.json({
      ok: true,
      caseId: kase.id,
      partnerRef: parsed.data.partnerRef ?? null,
      provider: analysis.provider,
      amountShekels: analysis.amountShekels,
      plan: analysis.plan,
      strategy: rec.strategy,
      targetShekels: rec.targetShekels,
      draftMessage: rec.draftMessage,
      status: kase.status,
    });
  } catch (err) {
    await reportError(err, { route: "v1-submit-bill", partnerId: auth.partner.id });
    return errorResponse("processingFailed", 500);
  }
}
