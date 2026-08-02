import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { prisma } from "@/lib/prisma";
import type { RightsProfile } from "@/lib/rights";
import { DashboardNextActionClient } from "@/components/DashboardNextActionClient";
import type { Locale } from "@/i18n/config";
import { bcp47 } from "@/i18n/config";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";

const SETTLED = new Set(["SENT", "SAVED", "NO_SAVING", "REVOKED"]);
const PRE_SEND = new Set(["ANALYZED", "APPROVED", "VERIFIED"]);

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
      select: { id: true, vertical: true, status: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const preSend = cases.find((c) => PRE_SEND.has(c.status));
  if (preSend) {
    return (
      <Link
        href={`/dashboard?case=${preSend.id}`}
        className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.1)] px-5 py-4 hover:border-[rgba(240,180,92,0.6)] transition-colors"
      >
        <div className="font-extrabold text-[15px] text-[#f0b45c]">{t("agentNudgeTitle")}</div>
        <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">{t("agentNudgeSub")}</p>
      </Link>
    );
  }

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  if (sentIds.length > 0) {
    const proposed = await getProposedSavingsMap(sentIds);
    const proposedCaseId = sentIds.find((id) => proposed.has(id));
    if (proposedCaseId) {
      return (
        <Link
          href={`/dashboard?case=${proposedCaseId}`}
          className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-5 py-4 hover:border-[rgba(63,203,155,0.55)] transition-colors"
        >
          <div className="font-extrabold text-[15px] text-emerald">{t("proposedNudgeTitle")}</div>
          <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">{t("proposedNudgeSub")}</p>
        </Link>
      );
    }

    const sent = cases.find((c) => c.status === "SENT");
    if (sent) {
      return (
        <Link
          href={`/dashboard?case=${sent.id}`}
          className="block no-underline text-ink mb-5 rounded-2xl border border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.1)] px-5 py-4 hover:border-[rgba(240,180,92,0.6)] transition-colors"
        >
          <div className="font-extrabold text-[15px] text-[#f0b45c]">{t("agentNudgeTitle")}</div>
          <p className="text-[13px] text-ink-soft mt-1.5 mb-0 leading-relaxed">{t("agentNudgeSub")}</p>
        </Link>
      );
    }
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
