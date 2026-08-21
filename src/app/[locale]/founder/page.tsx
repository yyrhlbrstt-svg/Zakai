import type { Metadata } from "next";
import { headers } from "next/headers";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect, Link } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders } from "@/lib/ratelimit";
import { logSecurityEvent } from "@/lib/security/securityEvent";
import { isAdminEmail } from "@/lib/ops/internalAdminGate";
import { isEmailVerified } from "@/lib/services/emailVerification";
import { emailConfigured } from "@/lib/messaging";
import { formatAgorot } from "@/lib/money";
import { computeRecoveryGraph } from "@/lib/recoveryGraph";
import { evaluateConsumerReleaseGate, paymentsFullyLive } from "@/lib/deploy/releaseGate";
import { getAgentRoundMap } from "@/lib/services/agentFollowUp";
import { MAX_AGENT_ROUNDS } from "@/lib/services/loopLimits";
import { aggregateVariantPerformance, type LearningOutcomeRow } from "@/lib/strategy/learningInsights";
import type { AutopilotFinding } from "@/lib/autopilot/findings";
import { ControlGatesStrip } from "@/components/ControlGatesStrip";
import { MonopolyMissionControl } from "@/components/MonopolyMissionControl";
import { PipeNetworkLive } from "@/components/PipeNetworkLive";
import { LoopVolumePanel } from "@/components/LoopVolumePanel";
import { GrantOwnerAccessButton } from "@/components/GrantOwnerAccessButton";
import { loadLoopVolume } from "@/lib/services/loopVolume";
import { bcp47, type Locale } from "@/i18n/config";
import { privatePageMetadata } from "@/lib/seo";
import { predictResponse } from "@/lib/intel/predictResponse";

const RELEASE_LABEL_HE: Record<string, string> = {
  database: "מסד נתונים",
  auth_secret: "AUTH_SECRET",
  mandate_signing_jwk: "חתימת Mandate (JWK)",
  mandate_signing_kid: "MANDATE_SIGNING_KID",
  cron_secret: "CRON_SECRET",
  mandate_issuer: "MANDATE_ISSUER",
  app_url: "NEXT_PUBLIC_APP_URL",
  smtp: "דואר יוצא (SMTP)",
  smtp_from: "SMTP_FROM",
  inbound_email_secret: "INBOUND_EMAIL_SECRET",
  mandate_issue_key: "MANDATE_ISSUE_KEY",
  mandate_revoke_key: "MANDATE_REVOKE_KEY",
  payments_live: "סליקה אמיתית (PayPlus)",
  admin_email: "ADMIN_EMAIL + אימות",
  ai: "מפתח AI",
  leads_email: "LEADS_EMAIL",
  sales_email: "SALES_EMAIL",
  vapid: "Web Push (VAPID)",
};

const AUTOPILOT_LABEL_HE: Record<string, string> = {
  "law-watcher": "Law Watcher — שינויים במקורות המשפטיים",
  "price-sentinel": "Price Sentinel — שינויי מחיר בדפים ציבוריים",
  "outcome-learner": "Outcome Learner — למידה מתוצאות תיקים",
  "growth-bot": "Growth Bot — הצעות תוכן מנתונים",
  "market-expander": "Market Expander — ביקוש לשווקים חדשים",
  "concentration-watcher": "Concentration Watcher — ריכוזיות סטטוטורית של התיקים הפעילים",
  "response-clock": "Response Clock — חלונות מענה שנסגרו ומה מדרגת ההסלמה הבאה",
};

export const dynamic = "force-dynamic";

/**
 * Founder-only metrics — the instrument for the #1 priority: proving the core
 * loop (draft → send → real saving) actually converts, across real cases.
 * Gated by ADMIN_EMAIL (comma-separated allowed). No admin system needed: it
 * reuses the normal session and just checks the email. Not linked anywhere.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pageMeta" });
  return privatePageMetadata(t("founder.t"));
}

export default async function FounderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const user = await getCurrentUser();
  if (!user) redirect({ href: "/login", locale });
  if (!isAdminEmail(user!.email)) redirect({ href: "/dashboard", locale });
  // Matching the address is not the same as controlling it. Signup accepts any
  // address, so without this an attacker who registered the ADMIN_EMAIL value
  // first would hold a dashboard listing every lead's name, phone and company.
  // The environment names who may be admin; this proves they are that person.
  if (!(await isEmailVerified(user!.id))) redirect({ href: "/dashboard", locale });

  await logSecurityEvent({
    type: "admin_access",
    userId: user!.id,
    ip: clientIpFromHeaders(await headers()),
  });

  const releaseGate = evaluateConsumerReleaseGate();
  const smtpOk = emailConfigured();
  const paymentsOk = paymentsFullyLive();
  const loopVolume = await loadLoopVolume(smtpOk);

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    byStatus,
    savedAgg,
    estimateProofs,
    documentedSaved,
    feeAgg,
    paidAgg,
    pendingFeeAgg,
    users,
    checks,
    recovery,
    newUsers7d,
    leadsByVertical,
    feedbackCount,
    leads,
    feedbackRows,
    partnerSignups,
    outboxQueued,
    outboxFailed,
    mandatesActive,
    mandatesOnSentPlus,
    mandatesIssued7d,
    proofsDocumented7d,
    stuckNoMandate,
    stuckNoOutreach,
    sentOpenIds,
  ] = await Promise.all([
    prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
    // Documented pipeline only — estimate shortcuts must not inflate the founder instrument.
    prisma.savingsProof.aggregate({
      where: { selfReported: false, savingMonthly: { gt: 0 } },
      _sum: { savingMonthly: true },
      _count: { _all: true },
    }),
    prisma.savingsProof.count({ where: { selfReported: true } }),
    prisma.case.count({
      where: {
        status: "SAVED",
        savingsProof: { is: { selfReported: false, savingMonthly: { gt: 0 } } },
      },
    }),
    prisma.fee.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    prisma.fee.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.fee.aggregate({
      where: { status: "PENDING", amount: { gt: 0 } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.user.count(),
    prisma.case.count(),
    computeRecoveryGraph(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.lead.groupBy({ by: ["vertical"], _count: { _all: true } }),
    prisma.feedback.count(),
    // Every /start submission, in full — this used to be split across this
    // page (a 25-row preview) and a separate, unlinked /leads page (a full
    // table). One inbox, not two half-built ones.
    prisma.lead.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
    // What people actually typed into "what would you improve in Zakai?" —
    // api/feedback's own comment promises this is stored "so the team can
    // read and prioritise from real user input." Nothing ever rendered it;
    // /founder showed only a count. This is that promise, finally kept.
    prisma.feedback.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    // Signups per B2B embed partner — the only way to answer "did this
    // partner send us anyone" now that middleware.ts actually captures the
    // ref. Excludes null so an empty partnerRef group doesn't show as "0"
    // pretending to be a partner.
    prisma.user.groupBy({
      by: ["partnerRef"],
      where: { partnerRef: { not: null } },
      _count: { _all: true },
    }),
    prisma.outbox.count({ where: { status: "QUEUED" } }),
    prisma.outbox.count({ where: { status: "FAILED" } }),
    prisma.authorization.count({ where: { status: "ACTIVE", revokedAt: null } }),
    // Mandates that actually left the building (case reached SENT+).
    prisma.authorization.count({
      where: { case: { status: { in: ["SENT", "SAVED", "NO_SAVING"] } } },
    }),
    prisma.authorization.count({ where: { issuedAt: { gte: weekAgo } } }),
    prisma.savingsProof.count({
      where: { selfReported: false, savingMonthly: { gt: 0 }, recordedAt: { gte: weekAgo } },
    }),
    // SENT stuck: no ACTIVE Mandate (missing or REVOKED) — cron/follow-up blocked.
    prisma.case.count({
      where: {
        status: "SENT",
        NOT: { authorization: { is: { status: "ACTIVE" } } },
      },
    }),
    // SENT stuck: no provider inbox to write to.
    prisma.case.count({
      where: {
        status: "SENT",
        OR: [{ counterpartyEmail: null }, { counterpartyEmail: "" }],
      },
    }),
    prisma.case.findMany({
      where: { status: "SENT" },
      select: { id: true },
      take: 2000,
    }),
  ]);

  // Second batch: time-boxed activity + "what works" — kept separate from the
  // query above so neither list gets harder to review than it already is.
  const [
    activeUsers30d,
    abandonedMidFlow,
    openedToday,
    openedWeek,
    openedMonth,
    successToday,
    successWeek,
    successMonth,
    failedToday,
    failedWeek,
    failedMonth,
    feeRevenueToday,
    feeRevenueWeek,
    feeRevenueMonth,
    savedAmountToday,
    savedAmountWeek,
    savedAmountMonth,
    strategyOutcomeRows,
  ] = await Promise.all([
    // "Active" = touched at least one case in the window — there is no login
    // timestamp on User, so this is the honest proxy, not a session count.
    prisma.case.groupBy({ by: ["userId"], where: { updatedAt: { gte: monthAgo } } }),
    // Sitting in a pre-send status for over a week with no further movement —
    // the "did they walk away" question, not just "how many are open now."
    prisma.case.count({
      where: { status: { in: ["ANALYZED", "APPROVED", "VERIFIED"] }, updatedAt: { lt: weekAgo } },
    }),
    prisma.case.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.case.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.case.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.savingsProof.count({
      where: { selfReported: false, savingMonthly: { gt: 0 }, recordedAt: { gte: dayAgo } },
    }),
    prisma.savingsProof.count({
      where: { selfReported: false, savingMonthly: { gt: 0 }, recordedAt: { gte: weekAgo } },
    }),
    prisma.savingsProof.count({
      where: { selfReported: false, savingMonthly: { gt: 0 }, recordedAt: { gte: monthAgo } },
    }),
    prisma.case.count({ where: { status: "NO_SAVING", updatedAt: { gte: dayAgo } } }),
    prisma.case.count({ where: { status: "NO_SAVING", updatedAt: { gte: weekAgo } } }),
    prisma.case.count({ where: { status: "NO_SAVING", updatedAt: { gte: monthAgo } } }),
    prisma.fee.aggregate({ where: { status: "PAID", paidAt: { gte: dayAgo } }, _sum: { amount: true } }),
    prisma.fee.aggregate({ where: { status: "PAID", paidAt: { gte: weekAgo } }, _sum: { amount: true } }),
    prisma.fee.aggregate({ where: { status: "PAID", paidAt: { gte: monthAgo } }, _sum: { amount: true } }),
    prisma.savingsProof.aggregate({
      where: { selfReported: false, savingMonthly: { gt: 0 }, recordedAt: { gte: dayAgo } },
      _sum: { savingMonthly: true },
    }),
    prisma.savingsProof.aggregate({
      where: { selfReported: false, savingMonthly: { gt: 0 }, recordedAt: { gte: weekAgo } },
      _sum: { savingMonthly: true },
    }),
    prisma.savingsProof.aggregate({
      where: { selfReported: false, savingMonthly: { gt: 0 }, recordedAt: { gte: monthAgo } },
      _sum: { savingMonthly: true },
    }),
    // "What approach wins" — same de-identified table the Strategy Engine
    // reads for chooseStance, aggregated globally instead of per-cohort.
    prisma.strategyOutcome.findMany({
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
      take: 5000,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const variantPerformance = aggregateVariantPerformance(strategyOutcomeRows as LearningOutcomeRow[]);

  /*
    Engine 1, run over the institution × claim-type cells that actually have
    closed cases. Capped at the busiest twelve so the panel stays a panel;
    each cell is one small aggregate query, and cells with too little
    evidence come back saying so rather than guessing.
  */
  const outcomeCells = await prisma.strategyOutcome
    .groupBy({
      by: ["market", "vertical", "counterparty"],
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 12,
    })
    .catch(() => [] as { market: string; vertical: string; counterparty: string }[]);
  const enginePredictions = await Promise.all(
    outcomeCells.map((c) =>
      predictResponse({ market: c.market, vertical: c.vertical, counterparty: c.counterparty }),
    ),
  );

  // Autopilot (law-watcher, price-sentinel, outcome-learner, growth-bot,
  // market-expander) runs daily via vercel.json cron and writes every result
  // to AutopilotRun — but nothing ever rendered it, so five real jobs ran
  // silently with no way to see a finding land. Latest run per job only.
  const autopilotJobIds = ["law-watcher", "price-sentinel", "outcome-learner", "growth-bot", "market-expander"] as const;
  const autopilotRuns = await Promise.all(
    autopilotJobIds.map((jobId) =>
      prisma.autopilotRun
        .findFirst({
          where: { jobId },
          orderBy: { createdAt: "desc" },
          select: { ok: true, summary: true, createdAt: true, findings: true },
        })
        .catch(() => null),
    ),
  );

  const agentRounds = await getAgentRoundMap(sentOpenIds.map((c) => c.id));
  const stuckMaxRounds = [...agentRounds.values()].filter((n) => n >= MAX_AGENT_ROUNDS).length;

  const count = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const sent = count("SENT") + count("SAVED") + count("NO_SAVING");
  const noSaving = count("NO_SAVING");
  // Win rate uses documented SavingsProof only — estimate SAVED must not count as a win.
  const settled = documentedSaved + noSaving;
  const winRate = settled > 0 ? Math.round((documentedSaved / settled) * 100) : null;
  const analyzed = count("ANALYZED");
  const approved = count("APPROVED");
  const verified = count("VERIFIED");
  const sentOnly = count("SENT");
  const preSendOpen = analyzed + approved + verified;

  const money = (a: number) => formatAgorot(a, "he-IL");

  const topVerticals = [...leadsByVertical].sort((a, b) => b._count._all - a._count._all).slice(0, 8);

  const totalLeads = leadsByVertical.reduce((s, r) => s + r._count._all, 0);
  const topLead = [...leadsByVertical].sort((a, b) => b._count._all - a._count._all)[0];
  const leadsValue =
    totalLeads === 0
      ? "אין עדיין"
      : `${totalLeads}${topLead ? ` · מוביל: ${topLead.vertical} (${topLead._count._all})` : ""}`;

  const rows: [string, string][] = [
    ["משתמשים", String(users)],
    ["— משתמשים חדשים (7 ימים) —", String(newUsers7d)],
    ["בדיקות שנפתחו", String(checks)],
    ["— Mandates פעילים (ACTIVE) —", String(mandatesActive)],
    ["— Mandates על תיקים SENT+ (נשלחו באמת) —", String(mandatesOnSentPlus)],
    ["— Mandates שהונפקו (7 ימים) —", String(mandatesIssued7d)],
    ["— SavingsProof מתועד (7 ימים) —", String(proofsDocumented7d)],
    ["— משפך: לפני שליחה (ANALYZED+APPROVED+VERIFIED) —", String(preSendOpen)],
    ["— משפך: SENT פתוח (ממתין ל־Proof) —", String(sentOnly)],
    ["— תקוע: SENT בלי Mandate פעיל —", String(stuckNoMandate)],
    ["— תקוע: SENT בלי אימייל ספק —", String(stuckNoOutreach)],
    [`— תקוע: SENT ב־${MAX_AGENT_ROUNDS}+ סיבובי מעקב —`, String(stuckMaxRounds)],
    ["לידים לעמלה (ביטוח/וורטיקלים)", leadsValue],
    ["משובים שהתקבלו", String(feedbackCount)],
    ["נשלחו לספק (SENT+)", String(sent)],
    ["הגיעו לתוצאה (נענו)", String(settled)],
    ["חיסכון מתועד (SAVED, לא הערכה)", String(documentedSaved)],
    ["הערכות selfReported (בלי עמלה)", String(estimateProofs)],
    ["ללא חיסכון (NO_SAVING)", String(noSaving)],
    ["— אחוז הצלחה (מתועד מהנענים) —", winRate === null ? "אין עדיין נתונים" : `${winRate}%`],
    ["סה״כ חיסכון חודשי מתועד", money(savedAgg._sum.savingMonthly ?? 0)],
    ["הוכחות חיסכון מתועדות", String(savedAgg._count._all)],
    ["עמלות שנוצרו", `${feeAgg._count._all} · ${money(feeAgg._sum.amount ?? 0)}`],
    ["עמלות ממתינות לגבייה", `${pendingFeeAgg._count._all} · ${money(pendingFeeAgg._sum.amount ?? 0)}`],
    ["עמלות ששולמו", `${paidAgg._count._all} · ${money(paidAgg._sum.amount ?? 0)}`],
    ["— Outbox בתור (SMTP?) —", String(outboxQueued)],
    ["— Outbox נכשל —", String(outboxFailed)],
  ];

  return (
    <main className="max-w-[920px] mx-auto px-5 pb-24 pt-8" dir="rtl">
      <h1 className="font-display text-3xl mb-1.5">מדדי מייסד</h1>
      <p className="text-ink-soft text-[14px] mb-4">
        המספרים היחידים: Mandates שנשלחו, SavingsProof מתועד, השלמה לפי וורטיקל. בלי vanity.
      </p>

      <div className="mb-6">
        <GrantOwnerAccessButton currentPlan={user!.plan} />
      </div>

      <nav className="flex flex-wrap gap-2 mb-6 text-[12.5px]">
        {[
          ["#recommendation", "מה לעשות עכשיו — P0"],
          ["#users", "משתמשים"],
          ["#money-time", "כסף לאורך זמן"],
          ["#cases-time", "תיקים לאורך זמן"],
          ["#approach", "מה עובד — לפי גישה"],
          ["#by-provider", "מה עובד — לפי ספק"],
          ["#autopilot", "אוטופיילוט"],
          ["#numbers", "כל המספרים"],
          ["#leads", "פניות"],
          ["#feedback", "משוב"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="rounded-full border border-[rgba(255,255,255,0.12)] px-3 py-1.5 text-ink-soft font-bold no-underline hover:border-[rgba(63,203,155,0.4)] hover:text-ink transition-colors"
          >
            {label}
          </a>
        ))}
      </nav>

      <LoopVolumePanel snap={loopVolume} locale={locale} />

      <h2 id="users" className="font-display text-xl mt-10 mb-1.5">משתמשים</h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        "פעיל" = נגע בתיק כלשהו ב-30 הימים האחרונים — אין לנו חותמת התחברות, זה הפרוקסי הכן. "נטשו
        באמצע" = תיק שנתקע לפני שליחה (עדיין ANALYZED/APPROVED/VERIFIED) בלי תזוזה מעל שבוע.
      </p>
      <div className="grid gap-3 mb-6 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
        {[
          ["סה״כ משתמשים", String(users)],
          ["חדשים (7 ימים)", String(newUsers7d)],
          ["פעילים (30 ימים)", String(activeUsers30d.length)],
          ["נטשו באמצע (תקוע >7 ימים)", String(abandonedMidFlow)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] px-4 py-3.5"
          >
            <div className="text-[11.5px] text-ink-soft mb-1">{label}</div>
            <div className="font-display text-2xl tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <h2 id="money-time" className="font-display text-xl mt-10 mb-1.5">כסף לאורך זמן</h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        הכנסה = עמלות ששולמו בפועל (לא נוצרו). חיסכון = SavingsProof מתועד בלבד, לא הערכות
        self-reported.
      </p>
      <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-x-auto mb-6">
        <table className="w-full text-body min-w-[420px]">
          <thead>
            <tr className="text-ink-soft text-[11.5px] uppercase tracking-wide">
              <th className="text-start px-4 py-3 font-bold"> </th>
              <th className="text-center px-3 py-3 font-bold">היום</th>
              <th className="text-center px-3 py-3 font-bold">7 ימים</th>
              <th className="text-center px-3 py-3 font-bold">30 ימים</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[rgba(255,255,255,0.07)]">
              <td className="px-4 py-3 font-extrabold">הכנסה (עמלות ששולמו)</td>
              <td className="text-center px-3 py-3 tabular-nums">{money(feeRevenueToday._sum.amount ?? 0)}</td>
              <td className="text-center px-3 py-3 tabular-nums">{money(feeRevenueWeek._sum.amount ?? 0)}</td>
              <td className="text-center px-3 py-3 tabular-nums font-extrabold text-emerald">
                {money(feeRevenueMonth._sum.amount ?? 0)}
              </td>
            </tr>
            <tr className="border-t border-[rgba(255,255,255,0.07)]">
              <td className="px-4 py-3 font-extrabold">חיסכון שהוחזר למשתמשים</td>
              <td className="text-center px-3 py-3 tabular-nums">{money(savedAmountToday._sum.savingMonthly ?? 0)}</td>
              <td className="text-center px-3 py-3 tabular-nums">{money(savedAmountWeek._sum.savingMonthly ?? 0)}</td>
              <td className="text-center px-3 py-3 tabular-nums font-extrabold text-emerald">
                {money(savedAmountMonth._sum.savingMonthly ?? 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="cases-time" className="font-display text-xl mt-10 mb-1.5">תיקים לאורך זמן</h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        "הצליחו" = SavingsProof מתועד נרשם בחלון. "נכשלו" = סומן NO_SAVING בחלון. השוואה בין השניים
        היא אחוז ההצלחה האמיתי של התקופה — לא המצטבר.
      </p>
      <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-x-auto mb-6">
        <table className="w-full text-body min-w-[420px]">
          <thead>
            <tr className="text-ink-soft text-[11.5px] uppercase tracking-wide">
              <th className="text-start px-4 py-3 font-bold"> </th>
              <th className="text-center px-3 py-3 font-bold">היום</th>
              <th className="text-center px-3 py-3 font-bold">7 ימים</th>
              <th className="text-center px-3 py-3 font-bold">30 ימים</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-[rgba(255,255,255,0.07)]">
              <td className="px-4 py-3 font-extrabold">נפתחו</td>
              <td className="text-center px-3 py-3 tabular-nums">{openedToday}</td>
              <td className="text-center px-3 py-3 tabular-nums">{openedWeek}</td>
              <td className="text-center px-3 py-3 tabular-nums font-extrabold">{openedMonth}</td>
            </tr>
            <tr className="border-t border-[rgba(255,255,255,0.07)]">
              <td className="px-4 py-3 font-extrabold text-emerald">הצליחו (SAVED מתועד)</td>
              <td className="text-center px-3 py-3 tabular-nums text-emerald">{successToday}</td>
              <td className="text-center px-3 py-3 tabular-nums text-emerald">{successWeek}</td>
              <td className="text-center px-3 py-3 tabular-nums font-extrabold text-emerald">{successMonth}</td>
            </tr>
            <tr className="border-t border-[rgba(255,255,255,0.07)]">
              <td className="px-4 py-3 font-extrabold text-[#F08A6B]">נכשלו (NO_SAVING)</td>
              <td className="text-center px-3 py-3 tabular-nums">{failedToday}</td>
              <td className="text-center px-3 py-3 tabular-nums">{failedWeek}</td>
              <td className="text-center px-3 py-3 tabular-nums font-extrabold">{failedMonth}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/*
        Engine 1, internal first exactly as the plan requires: read here,
        by the person running the operation, before it is ever offered to
        anyone. With no closed cases it says so — a prediction nobody earned
        is the one thing this table must never print.
      */}
      <h2 id="engine1" className="font-display text-xl mt-10 mb-1.5">
        מנוע 1 — מה צפוי מכל מוסד
      </h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        לכל צירוף של מוסד וסוג תביעה שיש עליו תיקים סגורים: סיכוי להסדר, טווח הסכום שהוחזר בפועל,
        זמן חציוני, והגישה שניצחה. מתחת ל־5 תוצאות המנוע לא מנחש — הוא אומר שאין מספיק ראיות.
        ציון הביטחון מורכב מנפח, טריות ודרגת ראיה בלבד; אין כאן מודל שפה ולכן אין רכיב של הסכמה
        בין מודלים.
      </p>
      {enginePredictions.length === 0 ? (
        <p className="text-ink-soft text-caption mb-6 leading-relaxed">
          אין עדיין תיקים סגורים לאף מוסד. זה ריק כי אין נתונים — לא כי המנוע לא עובד.
        </p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-x-auto mb-6">
          <table className="w-full text-body min-w-[520px]">
            <thead>
              <tr className="text-ink-soft text-micro uppercase tracking-wide">
                <th className="text-start px-4 py-3 font-bold">מוסד / תחום</th>
                <th className="text-center px-3 py-3 font-bold">תיקים</th>
                <th className="text-center px-3 py-3 font-bold">סיכוי הסדר</th>
                <th className="text-center px-3 py-3 font-bold">ימים</th>
                <th className="text-center px-3 py-3 font-bold">ביטחון</th>
              </tr>
            </thead>
            <tbody>
              {enginePredictions.map((p) => (
                <tr key={`${p.institution}:${p.claimType}`} className="border-t border-[rgba(255,255,255,0.07)]">
                  <td className="px-4 py-3 font-bold">
                    {p.institution} · {p.claimType}
                  </td>
                  <td className="text-center px-3 py-3">{p.basis.trials}</td>
                  <td className="text-center px-3 py-3">
                    {p.available ? `${Math.round((p.settleProbability ?? 0) * 100)}%` : "אין די ראיות"}
                  </td>
                  <td className="text-center px-3 py-3">{p.expectedDays ?? "—"}</td>
                  <td className="text-center px-3 py-3">{p.available ? p.confidence : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 id="approach" className="font-display text-xl mt-10 mb-1.5">מה עובד — לפי גישה</h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        אותה טבלת StrategyOutcome ש-chooseStance קורא ממנה, מצטברת גלובלית (לא לפי לקוח בודד): איזו
        גישת ניסוח מנצחת בממוצע, על פני כל הספקים והוורטיקלים. מוצג רק לגישה עם 5+ תוצאות מתועדות.
      </p>
      {variantPerformance.length === 0 ? (
        <p className="text-ink-soft text-[13.5px] mb-6">
          עוד אין 5 תוצאות מתועדות לאף גישה. זה לא ריק כי המנגנון לא עובד — זה ריק כי עדיין אין מספיק
          תיקים סגורים. ברגע שיש, זה מתמלא לבד.
        </p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-x-auto mb-6">
          <table className="w-full text-body min-w-[440px]">
            <thead>
              <tr className="text-ink-soft text-[11.5px] uppercase tracking-wide">
                <th className="text-start px-4 py-3 font-bold">גישה</th>
                <th className="text-center px-3 py-3 font-bold">תוצאות</th>
                <th className="text-center px-3 py-3 font-bold">אחוז הצלחה</th>
                <th className="text-center px-3 py-3 font-bold">חיסכון ממוצע</th>
              </tr>
            </thead>
            <tbody>
              {variantPerformance.map((v, i) => (
                <tr key={v.variantId} className="border-t border-[rgba(255,255,255,0.07)]">
                  <td className="px-4 py-3 font-extrabold">
                    {v.labelHe}
                    {i === 0 && (
                      <span className="ms-2 text-[10.5px] font-bold text-emerald uppercase tracking-wide">
                        מוביל
                      </span>
                    )}
                  </td>
                  <td className="text-center px-3 py-3 tabular-nums text-ink-soft">{v.trials}</td>
                  <td className="text-center px-3 py-3 tabular-nums font-extrabold text-emerald">
                    {Math.round(v.winRate * 100)}%
                  </td>
                  <td className="text-center px-3 py-3 tabular-nums">
                    {v.avgRecoveredMinor > 0 ? money(v.avgRecoveredMinor) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className={`rounded-2xl border px-5 py-4 mb-6 ${
          releaseGate.canReleaseConsumerApp
            ? "border-[rgba(63,203,155,0.45)] bg-[rgba(63,203,155,0.08)]"
            : "border-[rgba(240,138,107,0.45)] bg-[rgba(240,138,107,0.08)]"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="font-extrabold text-[15px]">שער שחרור צרכני</span>
          <span
            className={`font-display text-3xl tabular-nums ${
              releaseGate.canReleaseConsumerApp ? "grad-text" : "text-[#F08A6B]"
            }`}
          >
            {releaseGate.releaseScore}/100
          </span>
        </div>
        {!releaseGate.canReleaseConsumerApp && (
          <>
            <p className="text-body text-ink-soft mt-2 mb-3 leading-relaxed m-0">
              ציון תצורה — לא ציון ערך ולא סיבה להתבייש. חסרים למטה חוסמים מייל/סליקה אמיתיים;
              עדיין רצים על נפח Mandate ברגע שיש SMTP. תקן ב־Vercel, Redeploy:{" "}
              <code className="text-[12px]">/api/release-gate</code> ·{" "}
              <code className="text-[12px]">docs/RELEASE_100_HE.md</code>
            </p>
            <ul className="list-none p-0 m-0 flex flex-col gap-1.5">
              {releaseGate.checks
                .filter((c) => c.level !== "optional" && !c.ok)
                .map((c) => (
                  <li key={c.id} className="text-[12.5px] leading-snug">
                    <span className="text-[#F08A6B] font-bold">✗</span>{" "}
                    <b>{RELEASE_LABEL_HE[c.id] ?? c.id}</b>
                    <span className="text-ink-soft"> — {c.envKeys.join(", ")}</span>
                  </li>
                ))}
            </ul>
            <p className="text-[11.5px] text-ink-soft mt-3 mb-0">
              יצירת סודות: <code>node scripts/bootstrap-release-env.mjs</code> · מפתח Mandate:{" "}
              <code>node scripts/generate-mandate-key.mjs</code>
              · דירוג מוצר/תשתית: <code>docs/PRODUCT_RATING.md</code>
            </p>
          </>
        )}
        {releaseGate.canReleaseConsumerApp && (
          <p className="text-body text-emerald font-bold mt-2 mb-0">
            כל שכבות השחרור ירוקות — מותר לפרסם מבחינת תצורה. עדיין לוודא תיק אמיתי אחד end-to-end.
          </p>
        )}
      </div>

      {!smtpOk && (
        <div className="rounded-2xl border border-[rgba(240,138,107,0.4)] bg-[rgba(240,138,107,0.08)] px-5 py-4 mb-6 text-[13.5px] font-bold leading-relaxed">
          ⚠ SMTP לא מלא (צריך HOST + USER + PASS). "נשלחו לספק (SENT+)" למטה סופר תיקים שסומנו SENT
          באפליקציה — לא מיילים שבאמת יצאו. HOST לבד לא מספיק. עד שיוגדר SMTP מלא, שום פנייה לא
          הגיעה בפועל לאף ספק, ואחוז ההצלחה למטה לא אומר כלום על העולם האמיתי. הרץ{" "}
          <code>node scripts/preflight.mjs</code> — חייב בלי <code>MAIL: OFF</code> — לפני תיק אמיתי.
        </div>
      )}

      {!paymentsOk && (
        <div className="rounded-2xl border border-[rgba(240,180,92,0.45)] bg-[rgba(240,180,92,0.1)] px-5 py-4 mb-6 text-[13.5px] font-bold leading-relaxed">
          ⚠ סליקה במצב mock — <code>PAYMENT_PROVIDER</code> לא PayPlus מלא. עמלת הצלחה רצה מקצה לקצה
          בלי לגבות כרטיס אמיתי. עד{" "}
          <code>PAYMENT_PROVIDER=payplus</code> +{" "}
          <code>PAYPLUS_API_KEY</code> / <code>PAYPLUS_SECRET_KEY</code> /{" "}
          <code>PAYPLUS_PAYMENT_PAGE_UID</code>, הכנסות הצלחה על הנייר בלבד.{" "}
          <code>node scripts/preflight.mjs</code> חייב להראות FEES בלי MOCK.
        </div>
      )}

      <div id="recommendation" className="mb-2">
        <h2 className="font-display text-xl m-0 mb-1">P0 מנכ״ל — מונופול על הצינור</h2>
        <p className="text-body text-ink-soft m-0 mb-4 leading-relaxed">
          מונופול = כל מוסד וסוכן חייב לדבר Mandate→SavingsProof. השערים למטה הם מדד אימוץ — לא
          שווי. עד ש־gravity_tier≥gravity ו־G3/G5 ירוקים, PayPlus לא מקים מונופול. אל תחבר שלב D
          לפני זה.
        </p>
        <MonopolyMissionControl locale={locale} />
        <PipeNetworkLive locale={locale} bcp47={bcp47[locale as Locale] ?? "he-IL"} />
        <ControlGatesStrip locale={locale} />
        <div className="rounded-2xl border border-[rgba(62,198,255,0.35)] bg-[rgba(62,198,255,0.06)] px-5 py-4 mb-6 text-body leading-relaxed">
          <div className="font-extrabold text-[#3EC6FF] mb-2">פעולות אנושיות עכשיו (סדר חובה)</div>
          <ul className="m-0 ps-5 flex flex-col gap-1.5 text-ink-soft">
            <li>
              <b className="text-ink">1. SMTP_HOST</b> (+ USER/PASS/FROM) בפרוד — בלי זה אין מכתב
              אמיתי לספק. אחרי הגדרה: Redeploy + תיק ניסיון אחד עד SENT (לא QUEUED ב-Outbox).
            </li>
            <li>
              <b className="text-ink">2. PayPlus</b> —{" "}
              <code>PAYMENT_PROVIDER=payplus</code> + שלושת מפתחות PAYPLUS. בלי זה עמלת הצלחה נשארת
              mock אחרי SavingsProof.
            </li>
            <li>
              <b className="text-ink">3. Merge</b> את PR הלולאה ל־main + Redeploy — אחרת הפרוד נשאר
              מאחור על finish surface ישן.
            </li>
            <li>
              <b className="text-ink">4. נפח</b> — תיקי סלולר/ביטול/עמלות אמיתיים עד{" "}
              <code>gravity_tier=network</code>. לא מייל קר לבנקים.
            </li>
            <li>
              מגנט משיכה (הם כותבים אלינו אחרי נפח):{" "}
              <a className="text-emerald underline" href="/he/pipe">
                /he/pipe
              </a>{" "}
              ·{" "}
              <a className="text-emerald underline" href="/he/join-network">
                /he/join-network
              </a>{" "}
              ·{" "}
              <a className="text-emerald underline" href="/api/institution/pilot-package">
                pilot-package
              </a>
            </li>
            <li>
              מנפיק שני:{" "}
              <a className="text-emerald underline" href="/api/mandate/delegation/evidence">
                evidence dry-run
              </a>{" "}
              → <code>npm run delegation:admit-pilot</code>
            </li>
            <li>
              בדיקת מכונה: <code>npm run gravity:checklist</code> ·{" "}
              <a className="text-emerald underline" href="/api/network/trillion-gates">
                trillion-gates
              </a>
            </li>
            <li>
              תבנית תשובה למי שפונה: <code>docs/BANK_OUTREACH.md</code> ·{" "}
              <Link className="text-emerald underline" href="/institutions">
                /institutions
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <h2 id="numbers" className="font-display text-xl mt-10 mb-1.5">כל המספרים</h2>
      <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
        {rows.map(([label, value], i) => {
          const highlight = label.includes("אחוז הצלחה");
          return (
            <div
              key={label}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 ${
                i > 0 ? "border-t border-[rgba(255,255,255,0.07)]" : ""
              } ${highlight ? "bg-[rgba(63,203,155,0.06)]" : ""}`}
            >
              <span className={`text-[14px] ${highlight ? "font-extrabold text-emerald" : "text-ink-soft"}`}>
                {label}
              </span>
              <span
                className={`tabular-nums ${
                  highlight ? "font-display grad-text text-2xl" : "font-extrabold text-[15px]"
                }`}
              >
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* B2B embed partner performance — see middleware.ts capturePartnerRef.
          Before this section existed, there was no way to answer "did this
          partner's embed actually send us anyone" — the whole channel was
          marketing with zero measurement behind it. */}
      <h2 className="font-display text-xl mt-10 mb-1.5">ביצועי שותפים (embed)</h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        הרשמות שהגיעו דרך widget מוטמע (utm_source=embed) — לפי ref של השותף.
      </p>
      {partnerSignups.length === 0 ? (
        <p className="text-ink-soft text-[13.5px]">
          עדיין אין הרשמות משותף. ה-widget לא מטמיע את עצמו — צריך שותף שיטמיע אותו בפועל.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          {[...partnerSignups]
            .sort((a, b) => b._count._all - a._count._all)
            .map((p) => (
              <span
                key={p.partnerRef}
                className="text-[12.5px] font-bold text-ink-soft border border-[rgba(255,255,255,0.12)] rounded-full px-3 py-1.5"
              >
                {p.partnerRef} · <b className="text-ink">{p._count._all}</b>
              </span>
            ))}
        </div>
      )}

      {/* Who to call back. Institutional enquiries first: a bank asking for a
          pilot is not one lead among many, and burying it under consumer volume
          is how the one that matters gets answered a fortnight late. This used
          to be a 25-row preview here, duplicated by a separate, unlinked
          /leads page carrying the full 300-row table — one inbox now, not two
          half-built ones; /leads redirects here. */}
      <h2 id="leads" className="font-display text-xl mt-10 mb-1.5">פניות — למי לחזור</h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        כל פנייה נשמרת כאן לפני שנשלח מייל. אם אין SMTP או שהכתובת שגויה — המייל לא יוצא, והרשומה
        הזאת עדיין קיימת. זה המקור, המייל הוא רק התראה. סה״כ: <b className="text-emerald">{totalLeads}</b>
      </p>
      {topVerticals.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {topVerticals.map((v) => (
            <span
              key={v.vertical}
              className="text-[12px] font-bold text-ink-soft border border-[rgba(255,255,255,0.12)] rounded-full px-3 py-1.5"
            >
              {v.vertical} · <b className="text-ink">{v._count._all}</b>
            </span>
          ))}
        </div>
      )}
      {leads.length === 0 ? (
        <p className="text-ink-soft text-[13.5px]">אין עדיין פניות.</p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
          {[...leads]
            .sort((a, b) => {
              const ai = a.vertical.startsWith("business:") ? 0 : 1;
              const bi = b.vertical.startsWith("business:") ? 0 : 1;
              return ai - bi || b.createdAt.getTime() - a.createdAt.getTime();
            })
            .map((lead, i) => (
              <div
                key={lead.id}
                className={`px-5 py-3.5 ${i > 0 ? "border-t border-[rgba(255,255,255,0.07)]" : ""} ${
                  lead.vertical.startsWith("business:") ? "bg-[rgba(63,203,155,0.06)]" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-extrabold text-[14.5px]">
                    {lead.company || lead.name}
                  </span>
                  <span className="text-[11.5px] text-ink-soft">
                    {lead.vertical} · {lead.createdAt.toISOString().slice(0, 10)} · {lead.status}
                  </span>
                </div>
                <div className="text-body text-ink-soft mt-1" dir="ltr">
                  {[lead.company ? lead.name : null, lead.email, lead.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {lead.note && (
                  <p className="text-[12.5px] text-ink-soft mt-1.5 mb-0 whitespace-pre-wrap leading-relaxed">
                    {lead.note}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}

      {/* User feedback — api/feedback's own comment has promised since it was
          written that submissions are stored "so the team can read and
          prioritise from real user input." Nothing ever rendered them; this
          page showed only a count. A parent typing "קשה" into the feedback
          widget produced a row nobody could read without querying the DB
          directly — exactly the "tin can" gap this section closes. */}
      <h2 id="feedback" className="font-display text-xl mt-10 mb-1.5">משוב ממשתמשים</h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        כל מה שנכתב בתיבת "מה היית משפר בזכאי" — מהאתר, בלי צורך בחשבון. סה״כ:{" "}
        <b className="text-emerald">{feedbackCount}</b>
      </p>
      {feedbackRows.length === 0 ? (
        <p className="text-ink-soft text-[13.5px]">אין עדיין משוב.</p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-hidden">
          {feedbackRows.map((f, i) => (
            <div
              key={f.id}
              className={`px-5 py-3.5 ${i > 0 ? "border-t border-[rgba(255,255,255,0.07)]" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="text-[11.5px] text-ink-soft">
                  {f.context || "—"} · {f.createdAt.toISOString().slice(0, 10)}
                </span>
                {f.email && (
                  <a href={`mailto:${f.email}`} className="text-[11.5px] text-emerald font-bold" dir="ltr">
                    {f.email}
                  </a>
                )}
              </div>
              <p className="text-[13.5px] mt-1.5 mb-0 whitespace-pre-wrap leading-relaxed">{f.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* The recovery graph — the moat. Per counterparty: what actually works. */}
      <h2 id="by-provider" className="font-display text-xl mt-10 mb-1.5">מה עובד — לפי ספק</h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        החפיר האמיתי (אפקט רשת של דאטה): לכל ספק — אחוז הצלחה, חיסכון ממוצע וזמן ממוצע לתוצאה. ככל
        שנצבור תיקים, זה הופך ל"מה מנצח מול מי" שאף מתחרה לא יכול להעתיק.
      </p>
      {recovery.length === 0 ? (
        <p className="text-ink-soft text-[13.5px]">אין עדיין תיקים לנתח.</p>
      ) : (
        <div className="rounded-2xl border border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.02)] overflow-x-auto">
          <table className="w-full text-body min-w-[440px]">
            <thead>
              <tr className="text-ink-soft text-[11.5px] uppercase tracking-wide">
                <th className="text-start px-4 py-3 font-bold">ספק</th>
                <th className="text-center px-3 py-3 font-bold">נענו</th>
                <th className="text-center px-3 py-3 font-bold">אחוז הצלחה</th>
                <th className="text-center px-3 py-3 font-bold">חיסכון ממוצע</th>
                <th className="text-center px-3 py-3 font-bold">ימים לתוצאה</th>
              </tr>
            </thead>
            <tbody>
              {recovery.map((r) => (
                <tr key={r.provider} className="border-t border-[rgba(255,255,255,0.07)]">
                  <td className="px-4 py-3 font-extrabold">{r.provider}</td>
                  <td className="text-center px-3 py-3 tabular-nums text-ink-soft">{r.settled}</td>
                  <td className="text-center px-3 py-3 tabular-nums font-extrabold text-emerald">
                    {r.winRate === null ? "—" : `${r.winRate}%`}
                  </td>
                  <td className="text-center px-3 py-3 tabular-nums">
                    {r.avgSavingAgorot > 0 ? money(r.avgSavingAgorot) : "—"}
                  </td>
                  <td className="text-center px-3 py-3 tabular-nums text-ink-soft">
                    {r.avgDaysToResolve === null ? "—" : r.avgDaysToResolve}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Five real jobs run daily/weekly via vercel.json cron and write to
          AutopilotRun — law-watcher detects when a cited legal source
          changes, price-sentinel/outcome-learner/growth-bot/market-expander
          each watch a different signal. None of it had anywhere to surface
          until now, so every finding — including a law source actually
          changing — has been running silently since the day it shipped. */}
      <h2 id="autopilot" className="font-display text-xl mt-10 mb-1.5">אוטופיילוט</h2>
      <p className="text-ink-soft text-body mb-4 leading-relaxed">
        חמישה תהליכים רצים לבד (Law Watcher, Price Sentinel, Outcome Learner, Growth Bot, Market
        Expander) — כל אחד עם שער אנושי משלו, אף פעם לא ממזג טקסט משפטי או שולח משהו החוצה לבד.
      </p>
      <div className="flex flex-col gap-2">
        {autopilotJobIds.map((jobId, i) => {
          const run = autopilotRuns[i];
          const findings = (run?.findings as unknown as AutopilotFinding[] | null) ?? [];
          const notable = findings.filter((f) => f.severity !== "note");
          return (
            <div
              key={jobId}
              className="rounded-xl border border-[rgba(255,255,255,0.06)] px-4 py-3.5"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="font-bold text-body">{AUTOPILOT_LABEL_HE[jobId]}</span>
                {run ? (
                  <span className="text-micro text-ink-soft">
                    {run.createdAt.toLocaleDateString("he-IL")} ·{" "}
                    <span className={run.ok ? "text-emerald" : "text-danger"}>
                      {run.ok ? "תקין" : "נכשל"}
                    </span>
                  </span>
                ) : (
                  <span className="text-micro text-ink-soft">עוד לא רץ</span>
                )}
              </div>
              {run?.summary && (
                <p className="text-caption text-ink-soft mt-1.5 mb-0 leading-relaxed">{run.summary}</p>
              )}
              {notable.length > 0 && (
                <ul className="mt-2 mb-0 ps-4 flex flex-col gap-1">
                  {notable.map((f, fi) => (
                    <li
                      key={fi}
                      className={`text-micro leading-relaxed ${f.severity === "critical" ? "text-amber font-bold" : "text-ink-soft"}`}
                    >
                      {f.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11.5px] text-[rgba(147,166,165,0.85)] mt-5 leading-relaxed">
        עמוד פנימי, גלוי רק לכתובות ב-ADMIN_EMAIL. אם אחוז ההצלחה נמוך או לא יציב על מדגם אמיתי — זו
        התובנה הכי חשובה של המוצר, לפני כל ורטיקל או שיווק נוסף.
      </p>
    </main>
  );
}
