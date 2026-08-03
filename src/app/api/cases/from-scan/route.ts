import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { tryExpressMandateSend } from "@/lib/services/expressCaseOpen";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { rateLimit } from "@/lib/ratelimit";
import { runIdempotent, idempotencyKeyFromRequest } from "@/lib/scale/idempotency";
import type { CancelIntent } from "@/lib/cancelLetter";
import {
  buildFromScanDraft,
  defaultScanIntent,
  resolveFromScanOutreach,
} from "@/lib/fromScanOutreach";
import { stageLetterWithStance } from "@/lib/strategy/stageLetter";
import { formatCaseDraft } from "@/lib/caseDraft";
import { resolveCaseOutreachTo } from "@/lib/caseOutreach";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { buildRankedCaseInputs } from "@/lib/services/rankCasesForNextAction";
import { nextActionHref, rankNextAction } from "@/lib/services/nextAction";

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

  const idemKey = idempotencyKeyFromRequest(request);

  const idem = await runIdempotent<Record<string, unknown>>({
    scope: "cases-from-scan",
    key: idemKey,
    actorId: auth.userId,
    run: async () => {
      const body = await request.json().catch(() => null);
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { status: 400, body: { error: "genericError" } as const };
      const data = parsed.data;

      const user = await prisma.user.findUnique({ where: { id: auth.userId } });
      if (!user) return { status: 401, body: { error: "mustLogin" } as const };

      const activeCount = await prisma.case.count({
        where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
      });
      if (!canOpenCase(user.plan, activeCount)) {
        return { status: 403, body: { error: "caseLimit" } as const };
      }

      // Finish the open loop before forking another Case — OS, not toolbox.
      {
        const openCases = await prisma.case.findMany({
          where: { userId: auth.userId },
          select: {
            id: true,
            status: true,
            provider: true,
            vertical: true,
            amountOriginal: true,
            targetAmount: true,
            counterpartyEmail: true,
            fee: { select: { amount: true, status: true } },
            authorization: { select: { status: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 40,
        });
        const sentIds = openCases.filter((c) => c.status === "SENT").map((c) => c.id);
        const [proposedMap, agentRounds] = await Promise.all([
          sentIds.length > 0 ? getProposedSavingsMap(sentIds) : Promise.resolve(new Map()),
          getAgentRoundMap(sentIds),
        ]);
        const proposedHints = new Map(
          [...proposedMap.entries()].map(([id, p]) => [id, { newAmountShekels: p.newAmountShekels }]),
        );
        const ranked = rankNextAction(
          await buildRankedCaseInputs(openCases, agentRounds),
          proposedHints,
        );
        if (ranked.kind !== "start_money") {
          return {
            status: 409,
            body: {
              error: "OPEN_LOOP",
              nextHref: nextActionHref(ranked),
              caseId: "caseId" in ranked ? ranked.caseId : undefined,
            } as const,
          };
        }
      }

      const intent: CancelIntent = data.intent ?? defaultScanIntent(data.category);
      const product = data.product?.trim() || data.merchant;
      const { vertical, providerKey, outreachTo } = resolveFromScanOutreach({
        merchant: data.merchant,
        product,
        category: data.category,
        contactEmail: data.contactEmail,
      });

      // Soft-open like bank-fees: never invent an inbox and never block case+Mandate
      // open when empty — dashboard CaseNextStep collects outreach before dispatch.
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
          counterpartyEmail,
          strategyVariant: staged.strategyVariant,
          strategySeed: staged.strategySeed,
          autoApprove: true,
        });
      } catch (err) {
        if (err instanceof CaseError && err.message === "CASE_LIMIT") {
          return { status: 403, body: { error: "caseLimit" } as const };
        }
        throw err;
      }

      // Same gesture → Mandate SENT when ownership + outreach are ready.
      const refreshed = await prisma.case.findUnique({
        where: { id: kase.id },
        select: {
          counterpartyEmail: true,
          provider: true,
          vertical: true,
        },
      });
      const outreachReady = refreshed
        ? resolveCaseOutreachTo({
            counterpartyEmail: refreshed.counterpartyEmail,
            provider: refreshed.provider,
            vertical: refreshed.vertical,
          })
        : "";
      const express = outreachReady
        ? await tryExpressMandateSend(kase.id, auth.userId, user.emailVerifiedAt)
        : { dispatched: false, delivered: false };

      return {
        status: 200,
        body: {
          caseId: kase.id,
          message: (express.dispatched ? "mandate_sent" : "case_opened") as
            | "mandate_sent"
            | "case_opened",
          dispatched: express.dispatched,
          delivered: express.delivered,
          needsOutreachEmail: !outreachReady,
        },
      };
    },
  });

  return NextResponse.json(idem.body, {
    status: idem.status,
    headers: idem.replayed ? { "X-Idempotent-Replayed": "1" } : undefined,
  });
}
