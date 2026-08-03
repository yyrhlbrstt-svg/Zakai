import { prisma } from "@/lib/prisma";
import { CaseNextStep } from "@/components/CaseNextStep";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { buildRankedCaseInputs } from "@/lib/services/rankCasesForNextAction";
import { rankNextAction } from "@/lib/services/nextAction";
import { proofsInboundAddress } from "@/lib/mandate/document";
import { emailConfigured } from "@/lib/messaging";
import { feeBasisForVertical } from "@/lib/verticals";
import { providerHebrewName } from "@/lib/providers";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";
import { cohortLearning, type LearningOutcomeRow } from "@/lib/strategy/learningInsights";
import { heEn } from "@/lib/heEn";

/**
 * Finish surface on /money — the ranked CaseNextStep in place, not a link away.
 */
export async function MoneyLoopCloser({
  userId,
  locale,
  plan,
  emailVerified,
  referralCode,
  focusCaseId,
}: {
  userId: string;
  locale: Locale;
  plan: string;
  emailVerified: boolean;
  referralCode?: string;
  /** Deep-link from vertical open / notifications — prefer this case when owned. */
  focusCaseId?: string | null;
}) {
  const cases = await prisma.case.findMany({
    where: { userId },
    include: { savingsProof: true, fee: true, authorization: true },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });
  if (cases.length === 0) return null;

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  const [proposedMap, agentRounds, outcomeRows] = await Promise.all([
    sentIds.length > 0 ? getProposedSavingsMap(sentIds) : Promise.resolve(new Map()),
    getAgentRoundMap(sentIds),
    prisma.strategyOutcome
      .findMany({
        where: { market: "IL" },
        orderBy: { createdAt: "desc" },
        take: 4000,
        select: {
          market: true,
          vertical: true,
          counterparty: true,
          variantId: true,
          paid: true,
          recoveredMinor: true,
          days: true,
          selfReported: true,
        },
      })
      .catch(() => [] as LearningOutcomeRow[]),
  ]);
  const proposedHints = new Map(
    [...proposedMap.entries()].map(([id, p]) => [id, { newAmountShekels: p.newAmountShekels }]),
  );
  const ranked = rankNextAction(
    await buildRankedCaseInputs(
      cases.map((c) => ({
        id: c.id,
        status: c.status,
        provider: c.provider,
        vertical: c.vertical,
        amountOriginal: c.amountOriginal,
        targetAmount: c.targetAmount,
        counterpartyEmail: c.counterpartyEmail,
        fee: c.fee,
        authorization: c.authorization,
      })),
      agentRounds,
    ),
    proposedHints,
  );

  const focused =
    focusCaseId && cases.find((row) => row.id === focusCaseId) ? focusCaseId : null;
  const targetCaseId =
    focused ??
    (ranked.kind !== "start_money" && "caseId" in ranked ? ranked.caseId : null);
  if (!targetCaseId) return null;

  const c = cases.find((row) => row.id === targetCaseId);
  if (!c) return null;

  const proposed = proposedMap.get(c.id);
  const proposedClient = proposed
    ? {
        newAmountShekels: proposed.newAmountShekels,
        confidence: proposed.confidence,
        from: proposed.from,
      }
    : null;
  const loc = bcp47[locale];
  const cohort = cohortLearning(outcomeRows as LearningOutcomeRow[], "IL", c.vertical, c.provider);
  const learningTip = cohort
    ? {
        winRatePct: cohort.winRate * 100,
        trials: cohort.trials,
        bestStanceHe: cohort.bestStance?.labelHe,
        bestStanceEn: cohort.bestStance?.labelEn,
        medianDays: cohort.medianDaysToWin,
      }
    : null;
  const shareMsg =
    c.status === "SAVED" && c.savingsProof && c.savingsProof.savingMonthly > 0
      ? locale === "he" || locale === "ar"
        ? `תיעדתי חיסכון של ${formatAgorot(c.savingsProof.savingMonthly, loc)} עם זכאי`
        : `I documented ${formatAgorot(c.savingsProof.savingMonthly, loc)} savings with Zakai`
      : undefined;

  const he = locale === "he" || locale === "ar";

  return (
    <div className="mb-6 rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(6,12,18,0.55)] px-4 py-4">
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-emerald mb-1">
        {heEn(he, "פעולה אחת עכשיו", "One action now")}
      </div>
      <div className="font-extrabold text-[16px] mb-2">
        {providerHebrewName(c.provider)}
        <span className="text-ink-soft font-bold text-[13px] ms-2">{c.vertical}</span>
      </div>
      <CaseNextStep
        caseId={c.id}
        status={
          c.status as
            | "ANALYZED"
            | "APPROVED"
            | "VERIFIED"
            | "SENT"
            | "SAVED"
            | "NO_SAVING"
            | "REVOKED"
        }
        ownershipVerified={Boolean(c.ownershipVerifiedAt)}
        hasAuthorization={Boolean(c.authorization && c.authorization.status === "ACTIVE")}
        amountOriginalShekels={Math.round(c.amountOriginal / 100)}
        shareMessage={shareMsg}
        referralCode={referralCode}
        proposedSaving={proposedClient}
        proofsEmail={proofsInboundAddress()}
        agentRound={agentRounds.get(c.id) ?? 0}
        emailConfigured={emailConfigured()}
        vertical={c.vertical}
        feeBasis={feeBasisForVertical(c.vertical)}
        currentPlan={plan}
        documentedSavingShekels={
          c.savingsProof ? Math.round(c.savingsProof.savingMonthly / 100) : undefined
        }
        pendingFeeShekels={
          c.fee && c.fee.status === "PENDING" && c.fee.amount > 0
            ? Math.round(c.fee.amount / 100)
            : undefined
        }
        provider={c.provider}
        counterpartyEmail={c.counterpartyEmail}
        draftMessage={c.draftMessage}
        emailVerified={emailVerified}
        learningTip={learningTip}
      />
    </div>
  );
}
