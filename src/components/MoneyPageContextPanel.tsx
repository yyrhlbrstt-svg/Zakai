import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { rankNextAction } from "@/lib/services/nextAction";
import type { Locale } from "@/i18n/config";

export async function MoneyPageContextPanel({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "inline_app_locale_money_page" });
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="rounded-2xl border border-[rgba(62,198,255,0.3)] bg-[rgba(62,198,255,0.06)] px-4 py-3.5 mb-6 text-[13px] leading-relaxed">
        <span className="text-ink-soft">{t("guestHint")} </span>
        <Link href="/login" className="text-[#3ec6ff] font-bold no-underline">
          {t("guestLogin")}
        </Link>
      </div>
    );
  }

  const cases = await prisma.case.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      status: true,
      fee: { select: { amount: true, status: true } },
      authorization: { select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  const [proposedMap, agentRounds] = await Promise.all([
    sentIds.length > 0 ? getProposedSavingsMap(sentIds) : Promise.resolve(new Map()),
    getAgentRoundMap(sentIds),
  ]);
  const proposedHints = new Map(
    [...proposedMap.entries()].map(([id, p]) => [id, { newAmountShekels: p.newAmountShekels }]),
  );
  const action = rankNextAction(
    cases.map((c) => ({
      id: c.id,
      status: c.status,
      fee: c.fee,
      agentRound: agentRounds.get(c.id) ?? 0,
      mandateActive: c.authorization?.status === "ACTIVE",
    })),
    proposedHints,
  );

  if (action.kind === "pending_fee") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}&payFee=1`}
        className="block no-underline mb-6 rounded-2xl border border-[rgba(63,203,155,0.55)] bg-[rgba(63,203,155,0.14)] px-4 py-3.5 hover:border-[rgba(63,203,155,0.7)] transition-colors"
      >
        <div className="font-extrabold text-[14px] text-emerald">{t("pendingCaseTitle")}</div>
        <p className="text-[12.5px] text-ink-soft mt-1 mb-0">{t("pendingCaseSub")}</p>
      </Link>
    );
  }

  if (action.kind === "proposed_saving") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline mb-6 rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-4 py-3.5 hover:border-[rgba(63,203,155,0.55)] transition-colors"
      >
        <div className="font-extrabold text-[14px] text-emerald">{t("proposedTitle")}</div>
        <p className="text-[12.5px] text-ink-soft mt-1 mb-0">{t("proposedSub")}</p>
      </Link>
    );
  }

  if (action.kind === "sent_exhausted") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline mb-6 rounded-2xl border border-[rgba(240,138,107,0.5)] bg-[rgba(240,138,107,0.12)] px-4 py-3.5 hover:border-[rgba(240,138,107,0.65)] transition-colors"
      >
        <div className="font-extrabold text-[14px] text-[#f08a6b]">{t("exhaustedTitle")}</div>
        <p className="text-[12.5px] text-ink-soft mt-1 mb-0">{t("exhaustedSub")}</p>
      </Link>
    );
  }

  if (action.kind === "mandate_inactive") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline mb-6 rounded-2xl border border-[rgba(240,138,107,0.5)] bg-[rgba(240,138,107,0.12)] px-4 py-3.5 hover:border-[rgba(240,138,107,0.65)] transition-colors"
      >
        <div className="font-extrabold text-[14px] text-[#f08a6b]">{t("mandateInactiveTitle")}</div>
        <p className="text-[12.5px] text-ink-soft mt-1 mb-0">{t("mandateInactiveSub")}</p>
      </Link>
    );
  }

  if (action.kind === "pre_send" || action.kind === "sent_wait") {
    return (
      <Link
        href={`/dashboard?case=${action.caseId}`}
        className="block no-underline mb-6 rounded-2xl border border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.1)] px-4 py-3.5 hover:border-[rgba(240,180,92,0.6)] transition-colors"
      >
        <div className="font-extrabold text-[14px] text-[#f0b45c]">{t("pendingCaseTitle")}</div>
        <p className="text-[12.5px] text-ink-soft mt-1 mb-0">{t("pendingCaseSub")}</p>
      </Link>
    );
  }

  return null;
}
