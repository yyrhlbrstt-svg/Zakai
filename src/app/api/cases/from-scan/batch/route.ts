import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { canOpenCase, ACTIVE_CASE_STATUSES, planConfig } from "@/lib/plans";
import type { CancelIntent } from "@/lib/cancelLetter";
import { rateLimit } from "@/lib/ratelimit";
import { runIdempotent, idempotencyKeyFromRequest } from "@/lib/scale/idempotency";
import {
  buildFromScanDraft,
  defaultScanIntent,
  resolveFromScanOutreach,
} from "@/lib/fromScanOutreach";
import { stageLetterWithStance } from "@/lib/strategy/stageLetter";
import { formatCaseDraft } from "@/lib/caseDraft";
import {
  findOpenLoopBlock,
  tryExpressMandateSend,
} from "@/lib/services/expressCaseOpen";

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
 * Scan multi-select → open the first Case only.
 * Doctrine: finish one open loop before forking another. Remaining items
 * are skipped with reason finishFirst so the client can land on /money.
 */
export async function POST(request: Request) {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const limited = await rateLimit("cases-from-scan-batch", auth.userId, 10, 24 * 3600);
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const idemKey = idempotencyKeyFromRequest(request);

  const idem = await runIdempotent<Record<string, unknown>>({
    scope: "cases-from-scan-batch",
    key: idemKey,
    actorId: auth.userId,
    run: async () => {
      const body = await request.json().catch(() => null);
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { status: 400, body: { error: "genericError" } as const };

      const user = await prisma.user.findUnique({ where: { id: auth.userId } });
      if (!user) return { status: 401, body: { error: "mustLogin" } as const };

      const openLoop = await findOpenLoopBlock(auth.userId);
      if (openLoop) {
        return { status: 409, body: openLoop };
      }

      let activeCount = await prisma.case.count({
        where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
      });

      const opened: Array<{
        caseId: string;
        merchant: string;
        status: string;
        intent: string;
        targetShekels: number;
        needsOutreachEmail?: boolean;
        dispatched?: boolean;
        delivered?: boolean;
      }> = [];
      const skipped: Array<{ merchant: string; reason: string }> = [];

      for (const data of parsed.data.items) {
        // One Case per gesture — remaining selections wait until this loop finishes.
        if (opened.length > 0) {
          skipped.push({ merchant: data.merchant, reason: "finishFirst" });
          continue;
        }

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

        // Soft-open: missing inbox is collected on /money before send.
        const counterpartyEmail = outreachTo || undefined;

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

        const draft = buildFromScanDraft({
          customerName: user.name || "",
          merchant: data.merchant,
          product,
          monthlyShekels: amount,
          intent,
          country: user.country,
        });
        const staged = await stageLetterWithStance(
          { subject: draft.subject, body: draft.body },
          { vertical, counterparty: providerKey },
        );
        const draftMessage = formatCaseDraft(
          staged.letter.subject,
          staged.letter.body,
          user.country,
        );

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
            counterpartyEmail,
            strategyVariant: staged.strategyVariant,
            strategySeed: staged.strategySeed,
            autoApprove: true,
          });
          let dispatched = false;
          let delivered = false;
          if (counterpartyEmail) {
            const express = await tryExpressMandateSend(
              kase.id,
              auth.userId,
              user.emailVerifiedAt,
            );
            dispatched = express.dispatched;
            delivered = express.delivered;
          }
          opened.push({
            caseId: kase.id,
            merchant: data.merchant,
            status: dispatched ? "SENT" : kase.status,
            intent,
            targetShekels: target,
            needsOutreachEmail: !counterpartyEmail,
            dispatched,
            delivered,
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

      return {
        status: 200,
        body: {
          ok: true,
          opened,
          skipped,
          openedCount: opened.length,
          skippedCount: skipped.length,
          planLimit: maxCases,
          message: "batch_cases_opened_from_scan" as const,
        },
      };
    },
  });

  return NextResponse.json(idem.body, {
    status: idem.status,
    headers: idem.replayed ? { "X-Idempotent-Replayed": "1" } : undefined,
  });
}
