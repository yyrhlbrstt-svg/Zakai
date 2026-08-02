import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import type { Locale } from "@/i18n/config";

const ACTIVE = new Set(["ANALYZED", "APPROVED", "VERIFIED", "SENT"]);

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
    select: { id: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  const pending = cases.find((c) => ACTIVE.has(c.status));
  if (pending) {
    return (
      <Link
        href={`/dashboard?case=${pending.id}`}
        className="block no-underline mb-6 rounded-2xl border border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.1)] px-4 py-3.5 hover:border-[rgba(240,180,92,0.6)] transition-colors"
      >
        <div className="font-extrabold text-[14px] text-[#f0b45c]">{t("pendingCaseTitle")}</div>
        <p className="text-[12.5px] text-ink-soft mt-1 mb-0">{t("pendingCaseSub")}</p>
      </Link>
    );
  }

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  if (sentIds.length > 0) {
    const proposed = await getProposedSavingsMap(sentIds);
    if (proposed.size > 0) {
      const caseId = sentIds.find((id) => proposed.has(id)) ?? sentIds[0];
      return (
        <Link
          href={`/dashboard?case=${caseId}`}
          className="block no-underline mb-6 rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-4 py-3.5 hover:border-[rgba(63,203,155,0.55)] transition-colors"
        >
          <div className="font-extrabold text-[14px] text-emerald">{t("proposedTitle")}</div>
          <p className="text-[12.5px] text-ink-soft mt-1 mb-0">{t("proposedSub")}</p>
        </Link>
      );
    }
  }

  return null;
}
