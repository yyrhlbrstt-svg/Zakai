import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { MoneyHub } from "@/components/MoneyHub";
import { MoneyInstallInline } from "@/components/MoneyInstallInline";
import { MoneyPageContextPanel } from "@/components/MoneyPageContextPanel";
import { MoneyGrowthPanel } from "@/components/MoneyGrowthPanel";
import { PriorityActionsRanked } from "@/components/PriorityActionsRanked";
import { MONTHLY_LEAK_PIN_IDS } from "@/lib/priority";
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
import { FeePayButton } from "@/components/FeePayButton";
import { provenSavings } from "@/lib/services/selfReportedSaving";
import { prisma } from "@/lib/prisma";
import { getProposedSavingsMap } from "@/lib/services/proposedSaving";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { SENT_FOLLOWUP_AFTER_DAYS } from "@/lib/services/loopLimits";
import { nextActionHref, rankNextAction } from "@/lib/services/nextAction";
import { isOvernightFollowUpDue } from "@/lib/services/overnightFollowUpGate";
import { pickShareableSavedCaseId } from "@/lib/services/shareableSavedCase";
import {
  moneyPendingFeeHref,
  resolveMoneyPayFeeCaseId,
} from "@/lib/services/moneyPayFeeCase";
import { providerHebrewName } from "@/lib/providers";
import { formatAgorot } from "@/lib/money";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";

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
  searchParams?: Promise<{
    case?: string;
    sent?: string;
    fee?: string;
    payFee?: string;
    openLoop?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = searchParams ? await searchParams : {};
  const focusCaseId = typeof sp.case === "string" ? sp.case : null;
  const feeStatus = typeof sp.fee === "string" ? sp.fee : null;
  const payFee = sp.payFee === "1";
  // A vertical tool (parking, arnona, bank fees, ...) redirected here because
  // an existing open case had to be finished first — say so, or the jump away
  // from whatever the person was filling in reads as an unexplained glitch.
  const openLoopRedirect = sp.openLoop === "1";
  // URL ?sent=1 is a hint only — never show “delivered” without a SENT Outbox row.
  let justSent = false;
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
  let pendingFeeHref: string | null = null;
  /** Settled SAVED with proof — mount share finish even when openLoop is false. */
  let shareCaseId: string | null = null;
  let payFeeCaseId: string | null = null;
  const paymentsLive = paymentsFullyLive();
  let personalDocumented = {
    count: 0,
    monthlyAgorot: 0,
    pendingFeeAgorot: 0,
  };
  if (user) {
    // Independent of each other — same user.id, no shared dependency.
    const [deliveredRow, cases] = await Promise.all([
      sp.sent === "1" && focusCaseId
        ? prisma.outbox
            .findFirst({
              where: {
                caseId: focusCaseId,
                status: "SENT",
                case: { userId: user.id },
              },
              select: { id: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      prisma.case.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          status: true,
          updatedAt: true,
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
      }),
    ]);
    justSent = Boolean(deliveredRow);
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
      openLoopHref = nextActionHref(action, { paymentsLive });
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
      // HITL follow-up draft — same wait as cron/dashboard (no day-0 theater).
      if (
        action.kind === "sent_wait" &&
        focus &&
        isOvernightFollowUpDue({
          updatedAt: focus.updatedAt,
          waitDays: SENT_FOLLOWUP_AFTER_DAYS,
        })
      ) {
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
    // Never invent payFee=1 when Mandate inactive or PSP is mock.
    if (action.kind === "pending_fee" || action.kind === "mandate_inactive") {
      pendingFeeHref = nextActionHref(action, { paymentsLive });
    } else {
      const pendingFeeCase = cases.find(
        (c) => c.fee?.status === "PENDING" && (c.fee?.amount ?? 0) > 0,
      );
      if (pendingFeeCase) {
        pendingFeeHref = moneyPendingFeeHref({
          caseId: pendingFeeCase.id,
          mandateActive: pendingFeeCase.authorization?.status === "ACTIVE",
          paymentsLive,
        });
      }
    }
    // Always — even with OPEN_LOOP, a settled win stays shareable via the strip.
    shareCaseId = pickShareableSavedCaseId(cases);
    payFeeCaseId = resolveMoneyPayFeeCaseId({
      payFee,
      focusCaseId,
      cases,
    });
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
            proofs: tHome("home.gravityProofs", { count: proof.verifiedCount }),
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
          {openLoopRedirect && openLoop ? (
            <p className="text-[12.5px] text-ink-soft mb-2 leading-relaxed">
              {locale === "he" || locale === "ar"
                ? "הועברתם לכאן כי יש לכם תיק פתוח שצריך לסיים קודם — הכלי שפתחתם יחכה."
                : "Brought you here because you have an open case to finish first — the tool you opened will wait."}
            </p>
          ) : null}
          {openLoop ? (
            <OpenLoopFocusBanner locale={locale} href={openLoopHref} label={openLoopLabel} />
          ) : null}
          {!openLoop && !shareCaseId && !focusCaseId ? (
            <DashboardNextActionPanel userId={user.id} locale={locale as Locale} />
          ) : null}
          {justSent && focusCaseId ? (
            <div className="mb-4 rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-4 py-3.5 text-[13.5px] font-bold text-emerald">
              {locale === "he" || locale === "ar"
                ? "✓ Mandate נשלח לספק — השלב הבא: להמתין לתשובה, להדביק תשובה בכתב, או לתעד חיסכון."
                : "✓ Mandate delivered to the provider — next: wait for a reply, paste a written answer, or record a saving."}
            </div>
          ) : null}
          {openLoop || focusCaseId || shareCaseId ? (
            <MoneyLoopCloser
              userId={user.id}
              locale={locale as Locale}
              plan={user.plan}
              emailVerified={Boolean(user.emailVerifiedAt)}
              referralCode={user.referralCode}
              // Never let a settled shareable win steal focus from an open loop.
              focusCaseId={focusCaseId ?? (openLoop ? null : shareCaseId)}
            />
          ) : null}
          {overnightCases.length > 0 ? <OvernightAgent cases={overnightCases} /> : null}
          {feeStatus === "paid" ? (
            <div className="mb-4 rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.12)] px-4 py-3.5 text-[13.5px] font-bold text-emerald">
              {locale === "he" || locale === "ar"
                ? "✓ עמלת ההצלחה שולמה — אפשר לשתף את החיסכון המתועד."
                : "✓ Success fee paid — share your documented saving."}
            </div>
          ) : null}
          {feeStatus === "confirming" ? (
            <div className="mb-4 rounded-2xl border border-[rgba(62,198,255,0.45)] bg-[rgba(62,198,255,0.1)] px-4 py-3.5 text-[13.5px] font-bold text-[#3EC6FF]">
              {locale === "he" || locale === "ar"
                ? "התשלום בתהליך אישור אצל ספק הסליקה — רעננו בעוד רגע. השיתוף ייפתח רק אחרי אישור."
                : "Payment is confirming with the card processor — refresh in a moment. Share unlocks only after confirmation."}
            </div>
          ) : null}
          {feeStatus === "error" ? (
            <div className="mb-4 rounded-2xl border border-[rgba(240,138,107,0.45)] bg-[rgba(240,138,107,0.1)] px-4 py-3.5 text-[13.5px] font-bold text-[#f08a6b]">
              {locale === "he" || locale === "ar"
                ? "התשלום לא הושלם — נסו שוב מהכפתור למטה."
                : "Payment did not complete — try again with the button below."}
            </div>
          ) : null}
          {personalDocumented.pendingFeeAgorot > 0 && feeStatus !== "paid" && payFeeCaseId ? (
            <div className="mb-4 rounded-2xl border border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.1)] px-4 py-3.5 flex flex-wrap items-center gap-3 justify-between">
              <div>
                <div className="font-extrabold text-[14px] text-emerald">
                  {locale === "he" || locale === "ar" ? "עמלת הצלחה ממתינה" : "Success fee pending"}
                </div>
                <p className="text-[13px] text-ink-soft mt-1 mb-0">
                  {formatAgorot(personalDocumented.pendingFeeAgorot, loc)}
                </p>
              </div>
              <FeePayButton
                caseId={payFeeCaseId}
                // Never auto-start under mock PSP, or after a failed/confirming bounce.
                autoStart={
                  paymentsLive &&
                  payFee &&
                  feeStatus !== "error" &&
                  feeStatus !== "confirming"
                }
              />
              {!paymentsLive ? (
                <p className="w-full m-0 text-[11.5px] text-amber leading-relaxed">
                  {locale === "he" || locale === "ar"
                    ? "סליקה אמיתית עדיין לא מחוברת — זה רץ במצב הדגמה, לא נגבה כסף אמיתי."
                    : "Real payment processing isn't connected yet — this runs in demo mode, no real money is charged."}
                </p>
              ) : null}
            </div>
          ) : null}
          <PersonalProofStrip
            locale={locale as Locale}
            documentedCount={personalDocumented.count}
            documentedMonthlyAgorot={personalDocumented.monthlyAgorot}
            pendingFeeAgorot={personalDocumented.pendingFeeAgorot}
            pendingFeeHref={pendingFeeHref}
            shareCaseHref={shareCaseId ? `/money?case=${shareCaseId}` : null}
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
          <PriorityActionsRanked
            limit={3}
            pinIds={[...MONTHLY_LEAK_PIN_IDS]}
            excludeIds={["money"]}
          />
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
            <Link href="/bank-fees">
              <Button variant="ghost" className="!text-[13px]">
                {tIapp_locale_money_page("t_bankFeesShortcut")}
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
          <Link href={openLoopHref}>
            <Button className="!text-[14px]">
              {locale === "he" || locale === "ar" ? "המשיכו את התיק" : "Continue the case"} →
            </Button>
          </Link>
        </div>
      )}
    </VerticalPageShell>
  );
}
