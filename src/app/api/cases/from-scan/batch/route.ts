import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES, planConfig } from "@/lib/plans";
import type { CancelIntent } from "@/lib/cancelLetter";
import { rateLimit } from "@/lib/ratelimit";
import {
  buildFromScanDraft,
  defaultScanIntent,
  resolveFromScanOutreach,
} from "@/lib/fromScanOutreach";

const itemSchema = z.object({
  merchant: z.string().min(1).max(120),
  product: z.string().max(120).optional(),
  monthlyShekels: z.number().min(1).max(100000),
  category: z
    .enum(["cellular", "tv_internet", "electricity", "insurance", "fitness", "digital", "other"])
    .default("other"),
  intent: z.enum(["cancel", "retention", "downgrade", "pause"]).optional(),
  contactEmail: z.string().max(120).optional(),
});

const schema = z.object({
  items: z.array(itemSchema).min(1).max(5),
});

/**
 * Batch one-click Cases from Money Hub scan.
 * Opens up to 5 agent cases in one request, respecting plan case limits.
 * Each item follows the same autoApprove + letter path as /from-scan.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-from-scan-batch", auth.userId, 10, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("genericError");

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  let activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });

  const opened: Array<{
    caseId: string;
    merchant: string;
    status: string;
    intent: string;
    targetShekels: number;
  }> = [];
  const skipped: Array<{ merchant: string; reason: string }> = [];

  for (const data of parsed.data.items) {
    if (!canOpenCase(user.plan, activeCount)) {
      skipped.push({ merchant: data.merchant, reason: "caseLimit" });
      continue;
    }

    const intent: CancelIntent = data.intent ?? defaultScanIntent(data.category);

    const product = data.product?.trim() || data.merchant;
    const { vertical, providerKey, outreachTo } = resolveFromScanOutreach({
      merchant: data.merchant,
      product,
      category: data.category,
      contactEmail: data.contactEmail,
    });

    if (!outreachTo) {
      skipped.push({ merchant: data.merchant, reason: "needsOutreachEmail" });
      continue;
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

    try {
      const kase = await createCase({
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
      opened.push({
        caseId: kase.id,
        merchant: data.merchant,
        status: kase.status,
        intent,
        targetShekels: target,
      });
      activeCount += 1;
    } catch (err) {
      if (err instanceof CaseError && err.message === "CASE_LIMIT") {
        skipped.push({ merchant: data.merchant, reason: "caseLimit" });
        continue;
      }
      skipped.push({ merchant: data.merchant, reason: "error" });
    }
  }

  const maxCases = planConfig(user.plan).maxActiveCases;

  return NextResponse.json({
    ok: true,
    opened,
    skipped,
    openedCount: opened.length,
    skippedCount: skipped.length,
    planLimit: maxCases,
    message: "batch_cases_opened_from_scan",
  });
}
