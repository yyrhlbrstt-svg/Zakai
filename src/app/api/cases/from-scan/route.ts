import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { rateLimit } from "@/lib/ratelimit";
import type { CancelIntent } from "@/lib/cancelLetter";
import {
  buildFromScanDraft,
  defaultScanIntent,
  resolveFromScanOutreach,
} from "@/lib/fromScanOutreach";

const schema = z.object({
  merchant: z.string().min(1).max(120),
  product: z.string().max(120).optional(),
  monthlyShekels: z.number().min(1).max(100000),
  category: z
    .enum(["cellular", "tv_internet", "electricity", "insurance", "fitness", "digital", "other"])
    .default("other"),
  contactEmail: z.string().max(120).optional(),
  intent: z.enum(["cancel", "retention", "downgrade", "pause"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-from-scan", auth.userId, 30, 24 * 3600);
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

  const intent: CancelIntent = data.intent ?? defaultScanIntent(data.category);
  const product = data.product?.trim() || data.merchant;
  const { vertical, providerKey, outreachTo } = resolveFromScanOutreach({
    merchant: data.merchant,
    product,
    category: data.category,
    contactEmail: data.contactEmail,
  });

  if (!outreachTo) {
    return NextResponse.json({ error: "needsOutreachEmail" }, { status: 400 });
  }

  const amount = Math.round(data.monthlyShekels);
  const target =
    intent === "cancel" || intent === "pause" ? 0 : Math.round(amount * 0.7);

  const strategy =
    intent === "cancel"
      ? "ביטול מנוי שזוהה בסריקה — Mandate"
      : intent === "retention"
        ? "הורדת מחיר / שימור מסריקה"
        : intent === "downgrade"
          ? "הורדת מסלול מסריקה"
          : "הקפאת מנוי מסריקה";

  const { draftMessage } = buildFromScanDraft({
    customerName: user.name || "",
    merchant: data.merchant,
    product,
    monthlyShekels: amount,
    intent,
    country: user.country,
  });

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: providerKey.slice(0, 80),
      amountShekels: amount,
      plan: product.slice(0, 120),
      strategy,
      targetShekels: target,
      draftMessage,
      vertical,
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
    message: "case_opened",
  });
}
