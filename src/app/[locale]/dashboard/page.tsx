import { setRequestLocale, getTranslations } from "next-intl/server";
import { Sparkles, Inbox, User, Users } from "lucide-react";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { Card, Button } from "@/components/ui";
import { SpotlightCard } from "@/components/SpotlightCard";
import { PlanBadge } from "@/components/PlanBadge";
import { MoneyScoreCard } from "@/components/MoneyScoreCard";
import { VigilWatchCard } from "@/components/VigilWatchCard";
import { ShareResult } from "@/components/ShareResult";
import { ReferralCard } from "@/components/ReferralCard";
import { REFERRAL_REWARD_AGOROT } from "@/lib/referral";
import { FeePayButton } from "@/components/FeePayButton";
import { CaseNextStep } from "@/components/CaseNextStep";
import { ReminderBanner } from "@/components/ReminderBanner";
import { OvernightAgent } from "@/components/OvernightAgent";
import { Reveal } from "@/components/Reveal";
import { StrategyInsightsCard } from "@/components/StrategyInsightsCard";
import { computeMoneyScore } from "@/lib/moneyScore";
import { formatAgorot } from "@/lib/money";
import { providerHebrewName } from "@/lib/providers";
import { bcp47, type Locale } from "@/i18n/config";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { proofsInboundAddress } from "@/lib/mandate/document";
import { getAgentRoundMap, MAX_AGENT_ROUNDS } from "@/lib/services/agentFollowUp";
import { CaseHighlightScroll } from "@/components/CaseHighlightScroll";
import { DashboardNextActionPanel } from "@/components/DashboardNextActionPanel";
import { RetentionActionStrip } from "@/components/RetentionActionStrip";
import { loadRetentionPlan } from "@/lib/services/retentionPlan";
import { emailConfigured } from "@/lib/messaging";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";
import { feeBasisForVertical } from "@/lib/verticals";
import { EmailVerifyNudge } from "@/components/EmailVerifyNudge";

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
  searchParams: Promise<{ fee?: string; intent?: string; case?: string; saved?: string; payFee?: string }>;
}) {
  const { locale } = await params;
  const {
    fee: feeStatus,
    intent,
    case: highlightCase,
    saved: savedCelebrate,
    payFee,
  } = await searchParams;
  setRequestLocale(locale as Locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });

  const t = await getTranslations();
  const loc = bcp47[locale as Locale];
  const proofsEmail = proofsInboundAddress();

  const cases = await prisma.case.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    include: { savingsProof: true, fee: true, authorization: true },
  });

  const sentIds = cases.filter((c) => c.status === "SENT").map((c) => c.id);
  const proposedMap = await getProposedSavingsMap(sentIds);
  const proposedCount = proposedMap.size;

  const celebrateCase =
    (highlightCase
      ? cases.find((c) => c.id === highlightCase && c.status === "SAVED")
      : undefined) ??
    cases.find((c) => c.status === "SAVED" && (c.savingsProof?.savingMonthly ?? 0) > 0);

  const agentRoundMap =
    sentIds.length > 0 ? await getAgentRoundMap(sentIds) : new Map<string, number>();

  const totalDocumentedMonthly = cases.reduce(
    (sum, c) => sum + (c.savingsProof?.savingMonthly ?? 0),
    0,
  );

  // Open-loop potential only — settled cases must not inflate the hero forever.
  const OPEN_FOR_POTENTIAL = new Set(["ANALYZED", "APPROVED", "VERIFIED", "SENT"]);
  const totalPotential = cases.reduce((sum, c) => {
    if (!OPEN_FOR_POTENTIAL.has(c.status)) return sum;
    return sum + Math.max(0, c.amountOriginal - c.targetAmount);
  }, 0);

  const pendingFeeCases = cases.filter(
    (c) => c.fee?.status === "PENDING" && (c.fee?.amount ?? 0) > 0,
  );
  const pendingFeeAgorot = pendingFeeCases.reduce((s, c) => s + (c.fee?.amount ?? 0), 0);

  const payFeeCaseId =
    payFee === "1" && highlightCase && pendingFeeCases.some((c) => c.id === highlightCase)
      ? highlightCase
      : null;

  const pendingActions = cases.filter(
    (c) =>
      c.status === "ANALYZED" ||
      c.status === "APPROVED" ||
      c.status === "VERIFIED" ||
      c.status === "SENT",
  ).length;

  // Follow-up drafts only for silent SENT that still have rounds left.
  const sentCases = cases
    .filter(
      (c) =>
        c.status === "SENT" &&
        !proposedMap.has(c.id) &&
        (agentRoundMap.get(c.id) ?? 0) < MAX_AGENT_ROUNDS,
    )
    .map((c) => ({
      id: c.id,
      providerLabel: providerHebrewName(c.provider),
      agentRound: agentRoundMap.get(c.id) ?? 0,
    }));

  const ownCases = cases.filter((c) => !c.beneficiaryLabel);
  const familyGroups = new Map<string, typeof cases>();
  for (const c of cases) {
    if (!c.beneficiaryLabel) continue;
    const arr = familyGroups.get(c.beneficiaryLabel) ?? [];
    arr.push(c);
    familyGroups.set(c.beneficiaryLabel, arr);
  }
  const hasFamily = familyGroups.size > 0;

  const familyDocumented = [...familyGroups.entries()].map(([label, list]) => ({
    label,
    monthly: list.reduce((s, c) => s + (c.savingsProof?.savingMonthly ?? 0), 0),
    count: list.length,
  }));

  const referredCount = await prisma.user.count({ where: { referredById: user!.id } });
  const referralRow = await prisma.user.findUnique({
    where: { id: user!.id },
    select: { referralCode: true, referralCreditAgorot: true },
  });
  const referralCode = referralRow?.referralCode ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const invitePath = `/${locale}/signup?ref=${referralCode}`;
  const retentionActions = await loadRetentionPlan(user!.id);

  const renderCaseCard = (list: typeof cases) => (
    <Card className="py-1.5">
      {list.map((c, i) => {
        const settled = c.status === "SAVED" || c.status === "NO_SAVING";
        const effectiveNew = c.savingsProof ? c.savingsProof.newAmount : c.targetAmount;
        const delta = Math.max(0, c.amountOriginal - effectiveNew);
        const shareMsg =
          c.status === "SAVED" && c.savingsProof && c.savingsProof.savingMonthly > 0
            ? t("share.msgSaved", {
                amount: formatAgorot(c.savingsProof.savingMonthly, loc),
              })
            : undefined;
        const amountOriginalShekels = Math.round(c.amountOriginal / 100);
        const proposed = proposedMap.get(c.id);
        const proposedClient = proposed
          ? {
              newAmountShekels: proposed.newAmountShekels,
              confidence: proposed.confidence,
              from: proposed.from,
            }
          : null;
        const label = providerHebrewName(c.provider);
        return (
          <div
            key={c.id}
            id={`case-${c.id}`}
            className="flex items-center gap-3.5 px-5 py-4 flex-wrap"
            style={{
              borderBottom: i < list.length - 1 ? "1px solid rgba(255,255,255,0.09)" : "none",
            }}
          >
            <div className="flex-1 basis-[140px]">
              <div className="font-extrabold text-[15.5px]">{label}</div>
              <div className="text-xs text-ink-soft mt-0.5">
                {c.createdAt.toLocaleDateString(loc)}
                {c.vertical ? ` · ${c.vertical}` : ""}
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
            <div className="basis-full">
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
                amountOriginalShekels={amountOriginalShekels}
                shareMessage={shareMsg}
                referralCode={referralCode}
                proposedSaving={proposedClient}
                proofsEmail={proofsEmail}
                agentRound={agentRoundMap.get(c.id) ?? 0}
                emailConfigured={emailConfigured()}
                vertical={c.vertical}
                feeBasis={feeBasisForVertical(c.vertical)}
                currentPlan={user!.plan}
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
                emailVerified={Boolean(user!.emailVerifiedAt)}
              />
            </div>
          </div>
        );
      })}
    </Card>
  );

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

  const moneyLabel =
    locale === "he" ? "הכסף שלי" : locale === "ar" ? "أموالي" : locale === "ru" ? "Мои деньги" : "My money";

  const justDocumentedSaving = savedCelebrate === "1";
  const celebrateSavingAgorot = celebrateCase?.savingsProof?.savingMonthly ?? 0;
  const celebrateFeeBasis = celebrateCase ? feeBasisForVertical(celebrateCase.vertical) : "monthly";
  const celebrateProviderLabel = celebrateCase ? providerHebrewName(celebrateCase.provider) : "";
  const celebrateAmountLabel =
    celebrateSavingAgorot > 0
      ? celebrateFeeBasis === "monthly"
        ? `${formatAgorot(celebrateSavingAgorot, loc)}${t("common.perMonthTag")}`
        : formatAgorot(celebrateSavingAgorot, loc)
      : undefined;
  const shareMessage =
    justDocumentedSaving && celebrateSavingAgorot > 0
      ? t("share.msgSaved", { amount: formatAgorot(celebrateSavingAgorot, loc) })
      : totalDocumentedMonthly > 0
        ? t("share.msgSaved", { amount: formatAgorot(totalDocumentedMonthly, loc) })
        : t("share.msgReferral");
  const shareAmountLabel =
    justDocumentedSaving && celebrateAmountLabel
      ? celebrateAmountLabel
      : totalDocumentedMonthly > 0
        ? `${formatAgorot(totalDocumentedMonthly, loc)}${t("common.perMonthTag")}`
        : undefined;

  return (
    <main className="max-w-[900px] mx-auto px-5 pb-20 pt-1">
      <CaseHighlightScroll caseId={highlightCase} />
      <div className="flex items-center gap-3 flex-wrap my-3 mb-5">
        <h1 className="font-display text-3xl m-0">{t("dashboard.title")}</h1>
        <PlanBadge plan={user!.plan} />
      </div>

      <ReminderBanner />

      {!user!.emailVerifiedAt ? <EmailVerifyNudge /> : null}

      <DashboardNextActionPanel userId={user!.id} locale={locale as Locale} />
      <RetentionActionStrip locale={locale} actions={retentionActions} />

      {pendingFeeAgorot > 0 && feeStatus !== "paid" ? (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.1)] px-5 py-4 mb-5 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="font-extrabold text-[14.5px] text-emerald">{t("dashboard.feeOutstandingTitle")}</div>
            <p className="text-[13px] text-ink-soft mt-1 mb-0">
              {t("dashboard.feeOutstandingSub", {
                amount: formatAgorot(pendingFeeAgorot, loc),
              })}
            </p>
          </div>
          {(payFeeCaseId || pendingFeeCases[0]?.id) ? (
            <FeePayButton
              caseId={payFeeCaseId ?? pendingFeeCases[0]!.id}
              autoStart={Boolean(payFeeCaseId)}
            />
          ) : null}
        </div>
      ) : null}

      {!emailConfigured() && (
        <div className="rounded-2xl border border-[rgba(240,138,107,0.4)] bg-[rgba(240,138,107,0.08)] px-5 py-3.5 mb-5 text-[13px] leading-relaxed font-bold">
          {locale === "he"
            ? "שליחת מייל מהשרת לא מוגדרת (SMTP) — אפשר עדיין לפתוח תיק + Mandate ולשלוח מהמייל שלכם. ברגע שיוגדר SMTP, הסוכן ישלח ישירות לספק."
            : "Server email (SMTP) is not configured — you can still open a case + Mandate and send from your own mail. Once SMTP is set, the agent sends to the provider directly."}
        </div>
      )}

      {!paymentsFullyLive() && (
        <div className="rounded-2xl border border-[rgba(240,180,92,0.35)] bg-[rgba(240,180,92,0.08)] px-5 py-3.5 mb-5 text-[13px] leading-relaxed">
          {locale === "he"
            ? "סליקה במצב דמו — עמלת הצלחה לא גובה כסף אמיתי עד PayPlus מלא (בדיקה: /api/release-gate)."
            : "Payments are in demo mode — success fees do not collect real money until PayPlus is fully configured (/api/release-gate)."}
        </div>
      )}

      {proposedCount > 0 && (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-5 py-3.5 mb-5 text-[14px] font-bold">
          {locale === "he"
            ? `הסוכן זיהה ${proposedCount} תשובה${proposedCount > 1 ? "ות" : ""} מהספק — לחץ "רשום חיסכון בלחיצה אחת" בתיק`
            : `Agent spotted ${proposedCount} provider repl${proposedCount > 1 ? "ies" : "y"} — one-tap record saving on the case`}
        </div>
      )}

      {pendingActions > 0 && (
        <div className="rounded-2xl border border-[rgba(240,180,92,0.35)] bg-[rgba(240,180,92,0.08)] px-5 py-3.5 mb-5 text-[14px] font-bold">
          {locale === "he"
            ? `יש ${pendingActions} בדיקות שמחכות להמשך — לחץ על השלב הבא בכל אחת`
            : `${pendingActions} check${pendingActions > 1 ? "s" : ""} waiting for your next step`}
        </div>
      )}

      <OvernightAgent cases={sentCases} />

      {intent && (
        <div className="rounded-2xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.07)] px-5 py-4 mb-5 flex items-center gap-3">
          <Sparkles size={20} className="text-[#3ec6ff] shrink-0" aria-hidden />
          <div>
            <div className="font-extrabold text-[14.5px]">{t("dashboard.intentTitle")}</div>
            <div className="text-ink-soft text-[13px] mt-0.5">
              {t.has(`dashboard.intents.${intent}`)
                ? t(`dashboard.intents.${intent}`)
                : t("dashboard.intentGeneric")}
            </div>
          </div>
          <Link href="/money" className="ms-auto shrink-0">
            <Button>{moneyLabel}</Button>
          </Link>
        </div>
      )}
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
      {justDocumentedSaving && (
        <div className="rounded-2xl border border-[rgba(63,203,155,0.5)] bg-[rgba(63,203,155,0.14)] px-5 py-4 mb-5">
          <div className="font-display text-2xl grad-text m-0">{t("dashboard.savedCelebrateTitle")}</div>
          {celebrateSavingAgorot > 0 ? (
            <div className="font-display text-3xl font-black text-emerald mt-2">
              {formatAgorot(celebrateSavingAgorot, loc)}
              {celebrateFeeBasis === "monthly" ? t("common.perMonthTag") : null}
            </div>
          ) : null}
          <p className="text-[13.5px] text-ink-soft mt-2 mb-0 leading-relaxed">{t("dashboard.savedCelebrateSub")}</p>
          {celebrateCase?.fee &&
            celebrateCase.fee.status === "PENDING" &&
            celebrateCase.fee.amount > 0 &&
            payFeeCaseId !== celebrateCase.id && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-bold text-ink-soft">
                  {t("dashboard.feeTag")}: {formatAgorot(celebrateCase.fee.amount, loc)}
                </span>
                <FeePayButton caseId={celebrateCase.id} />
              </div>
            )}
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

      {cases.length === 0 ? (
        <Card className="text-center px-8 py-14">
          <Inbox size={40} className="mx-auto mb-3.5 text-ink-soft" aria-hidden />
          <div className="font-display text-2xl">{t("dashboard.empty")}</div>
          <div className="text-ink-soft text-[14.5px] mt-2">
            {locale === "he"
              ? "התחל ב-Money OS: סרוק חיובים, פתח תיק עם הסוכן — בלי להשאיר טלפון."
              : "Start with Money OS: scan charges, open an agent case — no phone left behind."}
          </div>
          <div className="flex flex-wrap gap-3 justify-center mt-6">
            <Link href="/money#zakai-money-scan">
              <Button className="!text-[15px] !px-6">{moneyLabel} →</Button>
            </Link>
          </div>
          <p className="text-[12.5px] text-ink-soft mt-5 mb-0 max-w-[420px] mx-auto leading-relaxed">
            {locale === "he"
              ? "דלת אחת: סריקה → תיק → Mandate → חיסכון מתועד. קיצורים אחרים רק אחרי שיש תיק."
              : "One door: scan → case → Mandate → documented saving. Other shortcuts only after you have a case."}
          </p>
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
                {totalDocumentedMonthly > 0 && (
                  <div className="text-[12.5px] text-emerald mt-2 font-bold">
                    {locale === "he"
                      ? `מתועד בפועל: ${formatAgorot(totalDocumentedMonthly, loc)}/ח׳${hasFamily ? " (כולל משפחה)" : ""}`
                      : `Documented: ${formatAgorot(totalDocumentedMonthly, loc)}/mo${hasFamily ? " (incl. household)" : ""}`}
                  </div>
                )}
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
            [...familyGroups.entries()].map(([label, list]) => {
              const groupSaved = list.reduce((s, c) => s + (c.savingsProof?.savingMonthly ?? 0), 0);
              return (
                <div key={label}>
                  <h2 className="text-[17px] font-extrabold mt-7 mb-1.5 flex items-center gap-2 flex-wrap">
                    <User size={17} className="text-emerald" aria-hidden />
                    {t("dashboard.checksFor", { name: label })}
                    {groupSaved > 0 && (
                      <span className="text-[13px] font-bold text-emerald">
                        · −{formatAgorot(groupSaved, loc)}/{locale === "he" ? "ח׳" : "mo"}
                      </span>
                    )}
                  </h2>
                  {renderCaseCard(list)}
                </div>
              );
            })}

          {hasFamily && familyDocumented.some((f) => f.monthly > 0) && (
            <Card className="mt-6 p-5 border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.06)]">
              <div className="font-extrabold text-[14.5px] flex items-center gap-2">
                <Users size={16} className="text-[#8B5CF6]" aria-hidden />
                {locale === "he" ? "סיכום משפחתי מתועד" : "Household documented savings"}
              </div>
              <ul className="mt-3 mb-0 ps-0 list-none flex flex-col gap-1.5">
                {familyDocumented
                  .filter((f) => f.monthly > 0)
                  .map((f) => (
                    <li key={f.label} className="flex justify-between text-[13.5px]">
                      <span className="text-ink-soft">
                        {f.label} · {f.count} {locale === "he" ? "תיקים" : "cases"}
                      </span>
                      <span className="font-extrabold text-emerald">
                        −{formatAgorot(f.monthly, loc)}/{locale === "he" ? "ח׳" : "mo"}
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          <div className="mt-7 rounded-2xl border border-[rgba(139,92,246,0.28)] bg-[rgba(139,92,246,0.06)] px-5 py-4 flex items-center gap-3.5 flex-wrap">
            <Users size={22} className="text-[#8B5CF6] shrink-0" aria-hidden />
            <div className="flex-1 min-w-[180px]">
              <div className="font-extrabold text-[14.5px]">
                {locale === "he"
                  ? hasFamily
                    ? "הוסף עוד חשבון משפחתי"
                    : "מצב משפחה — חשבון של אמא / סבתא"
                  : hasFamily
                    ? "Add another household bill"
                    : "Household mode — Mom / Grandma bill"}
              </div>
              <div className="text-ink-soft text-[12.5px] mt-0.5">
                {locale === "he"
                  ? "תיוג בלבד — התיק נשאר שלך, הטיוטות בשמך. בלי גישה לחשבון של צד ג׳."
                  : "Label only — the case stays yours, drafts in your name. No third-party account access."}
              </div>
            </div>
            <Link href="/check" className="shrink-0">
              <Button variant="ghost" className="!text-[13px]">
                {locale === "he" ? "פתח בדיקה משפחתית" : "Open family check"}
              </Button>
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/money">
              <Button>{moneyLabel}</Button>
            </Link>
            <Link href="/electricity">
              <Button variant="ghost">{locale === "he" ? "חשמל" : "Electricity"}</Button>
            </Link>
            <Link href="/cancel">
              <Button variant="ghost">{locale === "he" ? "ביטול מנוי" : "Cancel sub"}</Button>
            </Link>
            <Link href="/bank-fees">
              <Button variant="ghost">{locale === "he" ? "עמלות בנק" : "Bank fees"}</Button>
            </Link>
            <Link href="/check">
              <Button variant="ghost">{t("home.cta")}</Button>
            </Link>
            <Link href="/proofs">
              <Button variant="ghost">{locale === "he" ? "קיר חיסכונות" : "Savings wall"}</Button>
            </Link>
            <Link href="/documents">
              <Button variant="ghost">{locale === "he" ? "מסמכים" : "Documents"}</Button>
            </Link>
          </div>
        </>
      )}

      <MoneyScoreCard result={scoreResult} />

      <VigilWatchCard bcp47={loc} />

      <StrategyInsightsCard locale={locale} bcp47={loc} />

      {/* Prove → fee → share: no virality while a success fee is outstanding. */}
      {pendingFeeAgorot <= 0 ? (
        <ShareResult
          message={shareMessage}
          referralCode={referralCode}
          amountLabel={shareAmountLabel}
          kicker={justDocumentedSaving && celebrateProviderLabel ? celebrateProviderLabel : undefined}
        />
      ) : null}

      <div className="mt-5">
        <ReferralCard
          path={invitePath}
          fallbackLink={`${appUrl}${invitePath}`}
          creditAgorot={referralRow?.referralCreditAgorot ?? 0}
          rewardAgorot={REFERRAL_REWARD_AGOROT}
          bcp47={loc}
        />
      </div>

      <p className="mt-6 text-[11.5px] text-[rgba(147,166,165,0.6)]">
        {t("disclosure.agent")}
      </p>
    </main>
  );
}
