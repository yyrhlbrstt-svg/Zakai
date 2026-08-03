import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import type { RightsProfile } from "@/lib/rights";
import { DashboardNextActionClient } from "@/components/DashboardNextActionClient";
import type { Locale } from "@/i18n/config";
import { bcp47 } from "@/i18n/config";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { formatAgorot } from "@/lib/money";
import { rankNextAction } from "@/lib/services/nextAction";

const SETTLED = new Set(["SENT", "SAVED", "NO_SAVING", "REVOKED"]);

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
        vertical: true,
        status: true,
        fee: { select: { amount: true, status: true } },
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
  const rankedCases = cases.map((c) => ({
    ...c,
    agentRound: agentRounds.get(c.id) ?? 0,
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

  if (!profileRow?.data) {
    return (
      <Link
        href="/score"
        className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.07)] px-5 py-4 hover:border-[rgba(62,198,255,0.5)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-[#3ec6ff]">{t("scoreNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">{t("scoreNudgeSub")}</p>
      </Link>
    );
  }

  const profile = profileRow.data as unknown as RightsProfile;
  const actedOn = cases
    .filter((c) => SETTLED.has(c.status) && c.vertical)
    .map((c) => c.vertical as string);

  return <DashboardNextActionClient profile={profile} actedOn={actedOn} bcp47={loc} />;
}
