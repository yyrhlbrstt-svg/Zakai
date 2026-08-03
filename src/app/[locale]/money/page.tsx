import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { MoneyHub } from "@/components/MoneyHub";
import { MoneyInstallInline } from "@/components/MoneyInstallInline";
import { MoneyPageContextPanel } from "@/components/MoneyPageContextPanel";
import { MoneyGrowthPanel } from "@/components/MoneyGrowthPanel";
import { PriorityActionsRanked } from "@/components/PriorityActionsRanked";
import { VerticalPageShell } from "@/components/VerticalPageShell";
import { Button } from "@/components/ui";
import { aiAvailable } from "@/lib/ai";
import { bcp47, type Locale } from "@/i18n/config";
import { alternateLanguages } from "@/lib/seo";
import { proofsInboundAddress } from "@/lib/mandate/document";
import { getCurrentUser } from "@/lib/auth/user";
import { DashboardNextActionPanel } from "@/components/DashboardNextActionPanel";
import { EmailVerifyNudge } from "@/components/EmailVerifyNudge";
import { LiveGravityStrip } from "@/components/LiveGravityStrip";
import { PersonalProofStrip } from "@/components/PersonalProofStrip";
import { OpenLoopFocusBanner } from "@/components/OpenLoopFocusBanner";
import { MoneyLoopCloser } from "@/components/MoneyLoopCloser";
import { OvernightAgent } from "@/components/OvernightAgent";
import { provenSavings } from "@/lib/services/selfReportedSaving";
import { prisma } from "@/lib/prisma";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { nextActionHref, rankNextAction } from "@/lib/services/nextAction";
import { providerHebrewName } from "@/lib/providers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "inline_app_locale_money_page" });
  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
    alternates: { languages: alternateLanguages("/money") },
  };
}

export default async function MoneyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ case?: string; sent?: string }>;
}) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const focusCaseId = typeof sp.case === "string" ? sp.case : null;
  setRequestLocale(locale);
  const tIapp_locale_money_page = await getTranslations({ locale, namespace: "inline_app_locale_money_page" });
  const loc = bcp47[locale as Locale];
  const proofsEmail = proofsInboundAddress();
  const user = await getCurrentUser();
  const tHome = await getTranslations({ locale });
  const [proof, sentCount, mandateCount] = await Promise.all([
    provenSavings(),
    prisma.case.count({ where: { status: { in: ["SENT", "SAVED"] } } }).catch(() => 0),
    prisma.authorization
      .count({ where: { status: "ACTIVE", revokedAt: null } })
      .catch(() => 0),
  ]);

  let openLoop = false;
  let openLoopHref = "/money";
  let openLoopLabel = "";
  let overnightCases: Array<{ id: string; providerLabel: string; agentRound?: number }> = [];
  let personalDocumented = {
    count: 0,
    monthlyAgorot: 0,
    pendingFeeAgorot: 0,
  };
  if (user) {
    const cases = await prisma.case.findMany({
      where: { userId: user.id },
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
        savingsProof: { select: { savingMonthly: true, selfReported: true } },
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
    const { buildRankedCaseInputs } = await import("@/lib/services/rankCasesForNextAction");
    const rankedCases = await buildRankedCaseInputs(cases, agentRounds);
    const action = rankNextAction(rankedCases, proposedHints);
    openLoop = action.kind !== "start_money";
    if (openLoop) {
      openLoopHref = nextActionHref(action);
      const focus =
        "caseId" in action ? cases.find((c) => c.id === action.caseId) : null;
      const provider = focus ? providerHebrewName(focus.provider) : "";
      const he = locale === "he" || locale === "ar";
      openLoopLabel = he
        ? provider
          ? `התיק מול ${provider} ממתין לפעולה הבאה`
          : "יש תיק פתוח שממתין לפעולה הבאה"
        : provider
          ? `Your case with ${provider} needs the next step`
          : "An open case needs the next step";
      // HITL follow-up draft lives on the finish surface — not only dashboard.
      if (action.kind === "sent_wait" && focus) {
        overnightCases = [
          {
            id: focus.id,
            providerLabel: providerHebrewName(focus.provider),
            agentRound: agentRounds.get(focus.id) ?? 0,
          },
        ];
      }
    }
    personalDocumented = {
      count: cases.filter(
        (c) =>
          c.savingsProof &&
          !c.savingsProof.selfReported &&
          c.savingsProof.savingMonthly > 0,
      ).length,
      monthlyAgorot: cases.reduce((sum, c) => {
        if (!c.savingsProof || c.savingsProof.selfReported) return sum;
        return sum + c.savingsProof.savingMonthly;
      }, 0),
      pendingFeeAgorot: cases.reduce((sum, c) => {
        if (c.fee?.status === "PENDING") return sum + c.fee.amount;
        return sum;
      }, 0),
    };
  }

  return (
    <VerticalPageShell
      heroGlow
      kicker={tIapp_locale_money_page("t_98667843")}
      title={tIapp_locale_money_page("t_2144de53")}
      sub={tIapp_locale_money_page("t_ef77bbd3")}
    >
      <div className="mb-6">
        <LiveGravityStrip
          localeBcp47={loc}
          verifiedMinor={proof.verifiedMinor}
          verifiedCount={proof.verifiedCount}
          sentCount={sentCount}
          mandateCount={mandateCount}
          labels={{
            title: tHome("home.gravityTitle"),
            sent: tHome("home.gravitySent"),
            mandates: tHome("home.gravityMandates"),
            proofs: tHome("home.gravityProofs"),
            empty: tHome("home.gravityEmpty"),
            ledger: tHome("home.gravityLedger"),
          }}
        />
      </div>

      {/* Guests: light login nudge. Logged-in: single next-action panel (no duplicate). */}
      {!user ? <MoneyPageContextPanel locale={locale as Locale} /> : null}

      {user ? (
        <div className="mb-6">
          {!user.emailVerifiedAt ? <EmailVerifyNudge /> : null}
          {openLoop ? (
            <OpenLoopFocusBanner locale={locale} href={openLoopHref} label={openLoopLabel} />
          ) : null}
          {!openLoop ? (
            <DashboardNextActionPanel userId={user.id} locale={locale as Locale} />
          ) : null}
          {openLoop || focusCaseId ? (
            <MoneyLoopCloser
              userId={user.id}
              locale={locale as Locale}
              plan={user.plan}
              emailVerified={Boolean(user.emailVerifiedAt)}
              referralCode={user.referralCode}
              focusCaseId={focusCaseId}
            />
          ) : null}
          {overnightCases.length > 0 ? <OvernightAgent cases={overnightCases} /> : null}
          <PersonalProofStrip
            locale={locale as Locale}
            documentedCount={personalDocumented.count}
            documentedMonthlyAgorot={personalDocumented.monthlyAgorot}
            pendingFeeAgorot={personalDocumented.pendingFeeAgorot}
          />
        </div>
      ) : null}

      {/* Scan only when no open loop — finish Mandates/Proofs first. */}
      {!openLoop && !focusCaseId ? (
        <div className="mt-2 mb-6">
          <MoneyHub
            bcp47={loc}
            screenshotEnabled={aiAvailable()}
            referralCode={user?.referralCode}
          />
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-soft mb-8 leading-relaxed">
          {locale === "he" || locale === "ar"
            ? "סריקה חדשה תיפתח אחרי שתסגרו את התיק הפתוח — כך הלולאה נסגרת עם Mandate ו־SavingsProof."
            : "A new scan opens after you finish the open case — that is how Mandates and SavingsProofs compound."}
        </p>
      )}

      {/* Secondary doors only when no open loop — otherwise they steal Mandates/Proofs. */}
      {!openLoop && !focusCaseId ? (
        <div className="mb-8">
          <div className="font-extrabold text-[14px] mb-3">{tIapp_locale_money_page("priorityTitle")}</div>
          <PriorityActionsRanked limit={3} />
        </div>
      ) : null}

      {proofsEmail ? (
        <p className="text-[12px] text-ink-soft leading-relaxed mb-6 border border-[rgba(63,203,155,0.25)] rounded-xl px-4 py-3 bg-[rgba(63,203,155,0.06)]">
          {tIapp_locale_money_page("proofsHint", { email: proofsEmail })}
        </p>
      ) : null}

      <MoneyInstallInline />

      {!openLoop ? <MoneyGrowthPanel locale={locale as Locale} /> : null}

      {!openLoop ? (
        <div className="mt-10 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-5 py-5">
          <div className="font-extrabold text-[14px]">{tIapp_locale_money_page("t_26d7de3c")}</div>
          <div className="flex flex-wrap gap-3 mt-3">
            <Link href="/cancel">
              <Button variant="ghost" className="!text-[13px]">
                {tIapp_locale_money_page("t_bc18d8da")}
              </Button>
            </Link>
            <Link href="/check">
              <Button variant="ghost" className="!text-[13px]">
                {tIapp_locale_money_page("t_a4c2b6a9")}
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" className="!text-[13px]">
                {tIapp_locale_money_page("t_38d0577a")}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <Link href="/dashboard">
            <Button className="!text-[14px]">{tIapp_locale_money_page("t_38d0577a")} →</Button>
          </Link>
        </div>
      )}
    </VerticalPageShell>
  );
}
