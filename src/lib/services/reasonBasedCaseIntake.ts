import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId, badRequest } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { expressOpenBody, openLoopConflictIfAny, tryExpressMandateSend } from "@/lib/services/expressCaseOpen";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { rateLimit } from "@/lib/ratelimit";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { formatCaseDraft } from "@/lib/caseDraft";

/**
 * Shared POST handler behind every "reference number + counterparty + reason
 * chips" case-open route — first extracted from /api/cases/parking and
 * /api/cases/transport-fine, which were identical in every step except the
 * few values `compose` now returns. A new vertical of this shape is a config
 * object, not another 140-line copy of auth → rate-limit → stance → case →
 * express-send.
 */
export interface ReasonBasedCaseConfig<T> {
  schema: z.ZodType<T>;
  vertical: string;
  cacheKeyPrefix: string;
  /** Cases a user may open per day on this vertical. Default 15, matching the two routes this was extracted from. */
  rateLimitPerDay?: number;
  compose: (
    data: T,
    user: { name: string | null },
  ) => {
    /** User-supplied inbox, tried first. */
    outreachEmailCandidate: string | undefined;
    /** A resolved inbox for a known counterparty (e.g. a transport operator), tried if the above is unusable. */
    knownInboxCandidate?: string | undefined;
    provider: string;
    amountShekels: number;
    planLabel: string;
    strategyLabel: string;
    subject: string;
    body: string;
    beneficiaryLabel?: string;
  };
}

export async function handleReasonBasedCasePost<T>(
  request: Request,
  config: ReasonBasedCaseConfig<T>,
): Promise<NextResponse> {
  const auth = await requireUserId();
  if ("response" in auth) return auth.response;

  const openLoopRes = await openLoopConflictIfAny(auth.userId);
  if (openLoopRes) return openLoopRes;

  const limited = await rateLimit(
    config.cacheKeyPrefix,
    auth.userId,
    config.rateLimitPerDay ?? 15,
    24 * 3600,
  );
  if (!limited.ok) return NextResponse.json({ error: "tooManyRequests" }, { status: 429 });

  const raw = await request.json().catch(() => null);
  const parsed = config.schema.safeParse(raw);
  if (!parsed.success) return badRequest("genericError");

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return badRequest("mustLogin", 401);

  const composed = config.compose(parsed.data, user);

  // Without a real inbox this case never reaches SENT — collect before open.
  const outreachTo =
    firstOutreachEmail(composed.outreachEmailCandidate, composed.knownInboxCandidate) || undefined;
  if (!outreachTo) {
    return NextResponse.json({ error: "needsOutreachEmail" }, { status: 400 });
  }

  const activeCount = await prisma.case.count({
    where: { userId: auth.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return badRequest("caseLimit", 403);

  // Ask the Strategy Engine how to pitch this one, and actually apply it.
  // Recording a stance that did not change the letter would attribute an
  // outcome to a choice that had no effect — fabricated evidence, which is
  // worse than none because none is visibly absent.
  const stance = await chooseStance({
    market: "IL",
    vertical: config.vertical,
    counterparty: composed.provider.slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const drafted = { subject: composed.subject, body: composed.body };
  const staged = variant ? applyStance(drafted, variant) : drafted;
  const stanceApplied = variant !== undefined && stanceAffects(drafted, variant);

  let kase;
  try {
    kase = await createCase({
      userId: auth.userId,
      provider: composed.provider.slice(0, 80),
      amountShekels: composed.amountShekels,
      plan: composed.planLabel,
      strategy: composed.strategyLabel,
      targetShekels: 0,
      draftMessage: formatCaseDraft(staged.subject, staged.body, user.country),
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: config.vertical,
      beneficiaryLabel: composed.beneficiaryLabel,
      counterpartyEmail: outreachTo,
      autoApprove: true,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return badRequest("caseLimit", 403);
    }
    throw err;
  }

  const express = await tryExpressMandateSend(kase.id, auth.userId, user.emailVerifiedAt);
  return NextResponse.json(
    expressOpenBody({
      caseId: kase.id,
      ...express,
      extra: {
        subject: staged.subject,
        body: staged.body,
        status: express.dispatched ? "SENT" : kase.status,
      },
    }),
  );
}
