import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/config";
import { bcp47 } from "@/i18n/config";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { formatAgorot } from "@/lib/money";
import { rankNextAction } from "@/lib/services/nextAction";

export async function DashboardNextActionPanel({
  userId,
  locale,
}: {
  userId: string;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "dashboard" });
  const loc = bcp47[locale];

  const [profileRow, cases] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId }, select: { data: true } }),
    prisma.case.findMany({
      where: { userId },
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
    }),
  ]);

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  const [proposedMap, agentRounds] = await Promise.all([
    sentIds.length > 0 ? getProposedSavingsMap(sentIds) : Promise.resolve(new Map()),
    getAgentRoundMap(sentIds),
  ]);
  const proposedHints = new Map(
    [...proposedMap.entries()].map(([id, p]) => [id, { newAmountShekels: p.newAmountShekels }]),
  );
  const { resolveCaseOutreachTo } = await import("@/lib/caseOutreach");
  const rankedCases = cases.map((c) => ({
    id: c.id,
    status: c.status,
    fee: c.fee,
    agentRound: agentRounds.get(c.id) ?? 0,
    mandateActive: c.authorization?.status === "ACTIVE",
    hasOutreachEmail: Boolean(
      resolveCaseOutreachTo({
        counterpartyEmail: c.counterpartyEmail,
        provider: c.provider,
        vertical: c.vertical,
      }),
    ),
    expectedRecoveryAgorot: Math.max(0, c.amountOriginal - c.targetAmount),
  }));
  const action = rankNextAction(rankedCases, proposedHints);

  if (action.kind === "pending_fee") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}&payFee=1`}
        className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(63,203,155,0.55)] bg-[rgba(63,203,155,0.16)] px-5 py-4 hover:border-[rgba(63,203,155,0.7)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-emerald">{t("feeNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">
          {t("feeNudgeSub", { amount: formatAgorot(action.feeAmountAgorot, loc) })}
        </p>
      </Link>
    );
  }

  if (action.kind === "proposed_saving") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-5 py-4 hover:border-[rgba(63,203,155,0.55)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-emerald">{t("proposedNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">{t("proposedNudgeSub")}</p>
      </Link>
    );
  }

  if (action.kind === "sent_exhausted") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(240,138,107,0.5)] bg-[rgba(240,138,107,0.12)] px-5 py-4 hover:border-[rgba(240,138,107,0.65)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-[#f08a6b]">{t("exhaustedNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">{t("exhaustedNudgeSub")}</p>
      </Link>
    );
  }

  if (action.kind === "needs_outreach") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(240,180,92,0.5)] bg-[rgba(240,180,92,0.12)] px-5 py-4 hover:border-[rgba(240,180,92,0.65)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-[#f0b45c]">{t("needsOutreachNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">
          {t("needsOutreachNudgeSub")}
        </p>
      </Link>
    );
  }

  if (action.kind === "mandate_inactive") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(240,138,107,0.5)] bg-[rgba(240,138,107,0.12)] px-5 py-4 hover:border-[rgba(240,138,107,0.65)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-[#f08a6b]">{t("mandateInactiveNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">
          {t("mandateInactiveNudgeSub")}
        </p>
      </Link>
    );
  }

  if (action.kind === "pre_send") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.1)] px-5 py-4 hover:border-[rgba(240,180,92,0.6)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-[#f0b45c]">{t("preSendNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">{t("preSendNudgeSub")}</p>
      </Link>
    );
  }

  if (action.kind === "sent_wait") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.1)] px-5 py-4 hover:border-[rgba(240,180,92,0.6)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-[#f0b45c]">{t("sentWaitNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">{t("sentWaitNudgeSub")}</p>
      </Link>
    );
  }

  // start_money — the ranker already chose the single front door. Do not demote
  // it to score quiz or PriorityActions sprawl (that was the width trap).
  return (
    <div className="mb-5 flex flex-col gap-3">
      <Link
        href="/money#zakai-money-scan"
        className="block no-underline text-ink rounded-2xl border border-[rgba(63,203,155,0.55)] bg-[rgba(63,203,155,0.14)] px-5 py-4 hover:border-[rgba(63,203,155,0.7)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-emerald">{t("startMoneyNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">{t("startMoneyNudgeSub")}</p>
      </Link>
      {!profileRow?.data ? (
        <Link
          href="/score"
          className="block no-underline text-ink rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-3 hover:border-[rgba(62,198,255,0.35)] transition-colors"
        >
          <div className="font-extrabold text-[13.5px] text-ink-soft">{t("scoreNudgeTitle")}</div>
          <p className="text-[12.5px] text-ink-soft mt-1 mb-0 leading-relaxed">{t("scoreNudgeSub")}</p>
        </Link>
      ) : null}
    </div>
  );
}
