import "server-only";
import { prisma } from "@/lib/prisma";
import { createCase, CaseError } from "@/lib/services/cases";
import { chooseStance } from "@/lib/strategy/store";
import { applyStance, stanceAffects } from "@/lib/strategy/applyStance";
import { variantById } from "@/lib/strategy/variants";
import { canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { firstOutreachEmail } from "@/lib/outreachEmail";
import { expressOpenBody, tryExpressMandateSend } from "@/lib/services/expressCaseOpen";
import { formatCaseDraft } from "@/lib/caseDraft";

export interface VerticalLetter {
  subject: string;
  body: string;
}

export interface CreateExpressVerticalCaseInput {
  userId: string;
  vertical: string;
  /** Counterparty display name — sliced to Case.provider's 80-char bound. */
  provider: string;
  /** Raw candidate outreach address(es); resolved via firstOutreachEmail. */
  counterpartyEmailCandidates: (string | undefined | null)[];
  amountShekels: number;
  targetShekels: number;
  /** Case.planDescription — sliced to 120 chars. */
  planDescription: string;
  /** One-line Hebrew strategy summary shown on the dashboard. */
  strategy: string;
  letter: VerticalLetter;
  beneficiaryLabel?: string;
}

export type CreateExpressVerticalCaseResult =
  | {
      ok: true;
      body: ReturnType<typeof expressOpenBody<{ subject: string; body: string; status: string }>>;
    }
  | { ok: false; status: number; error: string };

/**
 * The shared "open a vertical's case with a Mandate-signed letter" flow that
 * warranty/parking/transport-fine/refund each hand-rolled almost identically
 * (resolve outreach email -> load user -> enforce case limit -> pick a
 * strategy stance -> createCase -> express-send -> shape the response).
 * New verticals (Level 1 of the leveling-up plan) call this instead of
 * re-copying that ~60 lines; the letter text and the zod schema are the only
 * genuinely vertical-specific parts and stay in each route.
 *
 * Existing routes (warranty/parking/transport-fine/refund) are left as-is —
 * they already work and are already tested; refactoring shipped, working
 * code under time pressure just to remove duplication is not worth the
 * regression risk. This factors out the pattern for what comes NEXT.
 */
export async function createExpressVerticalCase(
  input: CreateExpressVerticalCaseInput,
): Promise<CreateExpressVerticalCaseResult> {
  const outreachTo = firstOutreachEmail(...input.counterpartyEmailCandidates) || undefined;
  if (!outreachTo) {
    return { ok: false, status: 400, error: "needsOutreachEmail" };
  }

  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false, status: 401, error: "mustLogin" };

  const activeCount = await prisma.case.count({
    where: { userId: input.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user.plan, activeCount)) return { ok: false, status: 403, error: "caseLimit" };

  const stance = await chooseStance({
    market: "IL",
    vertical: input.vertical,
    counterparty: input.provider.slice(0, 64),
  });
  const variant = variantById(stance.variantId);
  const staged = variant ? applyStance(input.letter, variant) : input.letter;
  const stanceApplied = variant !== undefined && stanceAffects(input.letter, variant);

  let kase;
  try {
    kase = await createCase({
      userId: input.userId,
      provider: input.provider.slice(0, 80),
      amountShekels: input.amountShekels,
      plan: input.planDescription.slice(0, 120),
      strategy: input.strategy,
      targetShekels: input.targetShekels,
      draftMessage: formatCaseDraft(staged.subject, staged.body, user.country),
      strategyVariant: stanceApplied ? stance.variantId : undefined,
      strategySeed: stanceApplied ? stance.seed : undefined,
      vertical: input.vertical,
      beneficiaryLabel: input.beneficiaryLabel,
      counterpartyEmail: outreachTo,
      autoApprove: true,
    });
  } catch (err) {
    if (err instanceof CaseError && err.message === "CASE_LIMIT") {
      return { ok: false, status: 403, error: "caseLimit" };
    }
    throw err;
  }

  const express = await tryExpressMandateSend(kase.id, input.userId, user.emailVerifiedAt);
  return {
    ok: true,
    body: expressOpenBody({
      caseId: kase.id,
      ...express,
      extra: {
        subject: staged.subject,
        body: staged.body,
        status: express.dispatched ? "SENT" : kase.status,
      },
    }),
  };
}
