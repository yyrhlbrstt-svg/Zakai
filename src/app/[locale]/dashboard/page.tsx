import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { PlanBadge } from "@/components/PlanBadge";
import { MoneyScoreCard } from "@/components/MoneyScoreCard";
import { ShareResult } from "@/components/ShareResult";
import { FeePayButton } from "@/components/FeePayButton";
import { Reveal } from "@/components/Reveal";
import { computeMoneyScore } from "@/lib/moneyScore";
import { formatAgorot } from "@/lib/money";
import { bcp47, type Locale } from "@/i18n/config";

const STATUS_KEY: Record<string, string> = {
  ANALYZED: "analyzed",
  APPROVED: "approved",
  VERIFIED: "verified",
  SENT: "sent",
  SAVED: "saved",
  NO_SAVING: "no_saving",
  REVOKED: "revoked",
};

const STATUS_COLOR: Record<string, string> = {
  ANALYZED: "#3EC6FF",
  APPROVED: "#3EC6FF",
  VERIFIED: "#8B5CF6",
  SENT: "#F0B45C",
  SAVED: "#3FCB9B",
  NO_SAVING: "#93A6A5",
  REVOKED: "#F08A6B",
};

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fee?: string }>;
}) {
  const { locale } = await params;
  const { fee: feeStatus } = await searchParams;
  setRequestLocale(locale as Locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  const t = await getTranslations();
  const loc = bcp47[locale as Locale];

  const cases = await prisma.case.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    include: { savingsProof: true, fee: true },
  });

  // Total documented monthly saving (the real, proven number) — drives the
  // most viral share: a specific "Zakai got me ₪X back" spreads far better
  // than a generic invite.
  const totalDocumentedMonthly = cases.reduce(
    (sum, c) => sum + (c.savingsProof?.savingMonthly ?? 0),
    0,
  );

  const totalPotential = cases.reduce(
    (sum, c) => sum + Math.max(0, c.amountOriginal - c.targetAmount),
    0,
  );

  // Family mode: group checks by whom they were run for. Cases with an empty
  // label belong to the account owner and render first, ungrouped.
  const ownCases = cases.filter((c) => !c.beneficiaryLabel);
  const familyGroups = new Map<string, typeof cases>();
  for (const c of cases) {
    if (!c.beneficiaryLabel) continue;
    const arr = familyGroups.get(c.beneficiaryLabel) ?? [];
    arr.push(c);
    familyGroups.set(c.beneficiaryLabel, arr);
  }
  const hasFamily = familyGroups.size > 0;

  // One check row + the Card wrapper. Shared by the owner list and each
  // family-member group so the markup stays identical everywhere.
  const renderCaseCard = (list: typeof cases) => (
    <Card className="py-1.5">
      {list.map((c, i) => {
        const settled = c.status === "SAVED" || c.status === "NO_SAVING";
        const effectiveNew = c.savingsProof ? c.savingsProof.newAmount : c.targetAmount;
        const delta = Math.max(0, c.amountOriginal - effectiveNew);
        return (
          <div
            key={c.id}
            className="flex items-center gap-3.5 px-5 py-4 flex-wrap"
            style={{
              borderBottom: i < list.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
            }}
          >
            <div className="flex-1 basis-[140px]">
              <div className="font-extrabold text-[15.5px]">{t(`providers.${c.provider}`)}</div>
              <div className="text-xs text-ink-soft mt-0.5">
                {c.createdAt.toLocaleDateString(loc)}
              </div>
            </div>
            <div className="text-[14.5px]">
              <span className="font-display text-lg">{formatAgorot(c.amountOriginal, loc)}</span>
              <span className="text-ink-soft"> → </span>
              <span className="font-display grad-text text-lg">
                {formatAgorot(effectiveNew, loc)}
              </span>
            </div>
            <div className="text-[12.5px] text-emerald font-extrabold">
              −{formatAgorot(delta, loc)}
              {c.status === "SAVED"
                ? ` (${t("dashboard.verifiedSavedTag")})`
                : !settled
                  ? ` (${t("dashboard.savedTag")})`
                  : ""}
            </div>
            {c.fee && c.fee.status !== "WAIVED" && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-[12px] text-ink-soft">
                  {t("dashboard.feeTag")}: {formatAgorot(c.fee.amount, loc)}
                  {c.fee.status === "PAID" && ` ✓ ${t("dashboard.feePaid")}`}
                </div>
                {c.fee.status === "PENDING" && c.fee.amount > 0 && (
                  <FeePayButton caseId={c.id} />
                )}
              </div>
            )}
            <div
              className="text-[11px] font-extrabold rounded-full px-2.5 py-1"
              style={{
                color: STATUS_COLOR[c.status],
                background: `${STATUS_COLOR[c.status]}18`,
                border: `1px solid ${STATUS_COLOR[c.status]}44`,
              }}
            >
              {t(`dashboard.status.${STATUS_KEY[c.status]}`)}
            </div>
          </div>
        );
      })}
    </Card>
  );

  // Money Health Score — the recurring-need hook, from measurable activity.
  const referredCount = await prisma.user.count({ where: { referredById: user!.id } });
  const referralCode =
    (await prisma.user.findUnique({ where: { id: user!.id }, select: { referralCode: true } }))
      ?.referralCode ?? "";
  const lastActivity = cases[0]?.createdAt ?? null;
  const scoreResult = computeMoneyScore({
    casesCount: cases.length,
    hasDocumentedSaving: cases.some((c) => c.savingsProof != null),
    daysSinceActivity: lastActivity
      ? Math.floor((Date.now() - lastActivity.getTime()) / 86_400_000)
      : null,
    plan: user!.plan,
    hasReferred: referredCount > 0,
  });

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-20 pt-1">
      <div className="flex items-center gap-3 flex-wrap my-3 mb-5">
        <h1 className="font-display text-3xl m-0">{t("dashboard.title")}</h1>
        <PlanBadge plan={user!.plan} />
      </div>
      {feeStatus === "paid" && (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.4)] bg-[rgba(63,203,155,0.08)] px-5 py-3.5 mb-5 flex items-center gap-2.5">
          <span className="text-emerald text-lg" aria-hidden>
            ✓
          </span>
          <span className="text-[14px] font-bold">{t("dashboard.feePaidBanner")}</span>
        </div>
      )}
      {feeStatus === "error" && (
        <div className="rounded-2xl border border-[rgba(240,138,107,0.4)] bg-[rgba(240,138,107,0.08)] px-5 py-3.5 mb-5 text-[14px] font-bold">
          {t("dashboard.feeErrorBanner")}
        </div>
      )}
      {(user!.plan === "PRO" || user!.plan === "MAX") && (
        <div
          className={`rounded-2xl p-[1px] mb-6 ${
            user!.plan === "MAX"
              ? "bg-[linear-gradient(105deg,#f7d98a,#f0b45c_55%,#e79a3c)]"
              : "bg-[linear-gradient(105deg,#3fcb9b,#23cbb6_55%,#1fb6c9)]"
          }`}
        >
          <div className="rounded-2xl bg-[#0a1119] px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-extrabold text-[15px]">
                {t("dashboard.memberTitle", { plan: user!.plan })}
              </div>
              <div className="text-ink-soft text-[12.5px] mt-0.5">
                {t(user!.plan === "MAX" ? "dashboard.memberMax" : "dashboard.memberPro")}
              </div>
            </div>
            <Link href="/pricing" className="text-emerald text-[13px] font-bold no-underline shrink-0">
              {t("dashboard.memberManage")}
            </Link>
          </div>
        </div>
      )}

      <MoneyScoreCard result={scoreResult} />

      {/* Close the growth loop: sharing from here carries the user's referral
          code, so every "look what Zakai found me" also credits the sharer. */}
      <ShareResult
        message={
          totalDocumentedMonthly > 0
            ? t("share.msgSaved", { amount: formatAgorot(totalDocumentedMonthly, loc) })
            : t("share.msgReferral")
        }
        referralCode={referralCode}
      />

      {cases.length === 0 ? (
        <Card className="text-center px-8 py-14">
          <div className="text-[44px] mb-3.5">📭</div>
          <div className="font-display text-2xl">{t("dashboard.empty")}</div>
          <div className="text-ink-soft text-[14.5px] mt-2">{t("dashboard.emptySub")}</div>
          <Link href="/check">
            <Button className="mt-6">{t("home.cta")}</Button>
          </Link>
        </Card>
      ) : (
        <>
          <Reveal>
            <SpotlightCard className="p-7 relative overflow-hidden">
              <div
                className="absolute -top-[70px] -start-[50px] w-60 h-60 rounded-full"
                style={{ background: "#3FCB9B", filter: "blur(80px)", opacity: 0.26 }}
                aria-hidden
              />
              <div className="relative">
                <div className="text-[13px] text-ink-soft font-bold">{t("dashboard.potential")}</div>
                <div className="font-display grad-text text-5xl mt-2">
                  {formatAgorot(totalPotential, loc)} {t("common.perMonthTag")}
                </div>
                <div className="text-[12.5px] text-ink-soft mt-1.5">{t("dashboard.potentialSub")}</div>
              </div>
            </SpotlightCard>
          </Reveal>

          {ownCases.length > 0 && (
            <>
              <h2 className="text-[17px] font-extrabold mt-6 mb-3.5">
                {hasFamily ? t("dashboard.checksMine") : t("dashboard.checks")}
              </h2>
              {renderCaseCard(ownCases)}
            </>
          )}

          {hasFamily &&
            [...familyGroups.entries()].map(([label, list]) => (
              <div key={label}>
                <h2 className="text-[17px] font-extrabold mt-7 mb-3.5 flex items-center gap-2">
                  <span aria-hidden>👤</span>
                  {t("dashboard.checksFor", { name: label })}
                </h2>
                {renderCaseCard(list)}
              </div>
            ))}

          <div className="mt-6">
            <Link href="/check">
              <Button>{t("home.cta")}</Button>
            </Link>
          </div>
        </>
      )}

      <p className="mt-6 text-[11.5px] text-[rgba(147,166,165,0.6)]">
        {t("disclosure.agent")}
      </p>
    </main>
  );
}
