import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { pushToUser } from "@/lib/push";
import { RECHECK_AFTER_DAYS } from "@/lib/insights";
import { reportError } from "@/lib/report-error";
import { AGENT_SUBJECT_PREFIX, autoFollowUpCase } from "@/lib/services/agentFollowUp";
import { SENT_FOLLOWUP_AFTER_DAYS } from "@/lib/services/loopLimits";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { isReminderDue } from "@/lib/deadlines";
import { feePayAbsoluteUrl, feePayDashboardPath } from "@/lib/feePayPath";
import { localeForCountry } from "@/lib/localePath";
import {
  cohortLearning,
  followUpAfterDays,
  FOLLOWUP_AFTER_DAYS_MIN,
  type LearningOutcomeRow,
} from "@/lib/strategy/learningInsights";

export const dynamic = "force-dynamic";

const NUDGE_SUBJECT = "זכאי — המבצע שלך כנראה נגמר, שווה לבדוק שוב";
/** Don't nudge the same user more often than this for SAVED recheck. */
const NUDGE_COOLDOWN_DAYS = 60;
const SENT_COOLDOWN_DAYS = 12;
const FEE_NUDGE_SUBJECT = "זכאי — עמלת הצלחה ממתינה לתשלום";
const FEE_NUDGE_AFTER_DAYS = 3;
const FEE_NUDGE_COOLDOWN_DAYS = 7;

/**
 * Daily cron (Vercel):
 * 1) SAVED cases past promo window → re-check nudge to user
 * 2) SENT cases waiting 5+ days → AGENT auto-follow-up to the provider
 *    (Mandate-backed, written, no phone, no human).
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  // Cohort timing from StrategyOutcome (send→settle medians). Query at the
  // minimum wait; per-case filter applies followUpAfterDays(median).
  const cutoff = new Date(Date.now() - RECHECK_AFTER_DAYS * 86_400_000);
  const cooldown = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 86_400_000);
  const sentCutoff = new Date(Date.now() - FOLLOWUP_AFTER_DAYS_MIN * 86_400_000);
  const sentCooldown = new Date(Date.now() - SENT_COOLDOWN_DAYS * 86_400_000);

  const outcomeRows = (await prisma.strategyOutcome
    .findMany({
      where: { market: "IL" },
      orderBy: { createdAt: "desc" },
      take: 5000,
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
    })
    .catch(() => [])) as LearningOutcomeRow[];
  const cohortCache = new Map<string, ReturnType<typeof cohortLearning>>();
  function waitDaysFor(vertical: string, provider: string): number {
    const key = `${vertical}::${provider}`;
    if (!cohortCache.has(key)) {
      cohortCache.set(key, cohortLearning(outcomeRows, "IL", vertical, provider));
    }
    const cohort = cohortCache.get(key);
    return cohort?.medianDaysToWin != null
      ? followUpAfterDays(cohort.medianDaysToWin)
      : SENT_FOLLOWUP_AFTER_DAYS;
  }

  try {
    let savedSent = 0;
    let agentFollowUps = 0;
    let agentSkipped = 0;
    let feeNudges = 0;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
    const feeCutoff = new Date(Date.now() - FEE_NUDGE_AFTER_DAYS * 86_400_000);
    const feeCooldown = new Date(Date.now() - FEE_NUDGE_COOLDOWN_DAYS * 86_400_000);

    // —— 1. SAVED re-check ——
    const staleCases = await prisma.case.findMany({
      where: { status: "SAVED", savingsProof: { recordedAt: { lt: cutoff } } },
      select: { userId: true, user: { select: { email: true, name: true } } },
      take: 200,
    });

    const seenSaved = new Set<string>();
    for (const c of staleCases) {
      if (seenSaved.has(c.userId)) continue;
      seenSaved.add(c.userId);

      const recent = await prisma.outbox.findFirst({
        where: { toAddress: c.user.email, subject: NUDGE_SUBJECT, createdAt: { gt: cooldown } },
        select: { id: true },
      });
      if (recent) continue;

      await sendEmail({
        to: c.user.email,
        subject: NUDGE_SUBJECT,
        body: `שלום ${c.user.name},

עברו יותר מ-${RECHECK_AFTER_DAYS} ימים מאז שתיעדנו את החיסכון שלך — ובישראל, בדיוק בנקודה הזו מחירי מבצע נוטים לקפוץ חזרה.

בדיקה חוזרת לוקחת דקה: מעלים צילום מסך עדכני ב"הכסף שלי", וזכאי בודק אם המחיר זחל למעלה ופועל אם צריך. כרגיל — עמלה רק אם יש חיסכון מתועד.

לבדיקה: היכנסו ל"הכסף שלי" — ${appUrl}/he/money#zakai-money-scan

זכאי — הכסף שמגיע לך חוזר אליך.`,
      });
      // vigil/run.ts sends its statutory-deadline alerts through both email
      // and push; this nudge — arguably the warmer of the two, since it's
      // tied to a user who already has a proven, documented saving — only
      // ever called sendEmail. A user who opted into push notifications
      // specifically to avoid missing exactly this kind of thing was still
      // depending entirely on email deliverability for it. Best-effort and
      // silently a no-op with no subscription or no VAPID keys configured —
      // matches pushToUser's own contract, never blocks the email path above.
      await pushToUser(c.userId, {
        title: "המבצע שלך כנראה נגמר",
        body: "שווה לבדוק שוב אם המחיר עלה — לוקח דקה.",
        url: "/money#zakai-money-scan",
        tag: "recheck-nudge",
      });
      savedSent++;
    }

    // —— 2. AGENT auto-follow-up on SENT cases ——
    // Do NOT require ACTIVE Mandate here: autoFollowUpCase returns
    // NO_ACTIVE_MANDATE and the branch below nudges the user to re-issue.
    // Filtering ACTIVE made that branch unreachable.
    const waitingRaw = await prisma.case.findMany({
      where: {
        status: "SENT",
        updatedAt: { lt: sentCutoff },
        ownershipVerifiedAt: { not: null },
      },
      select: {
        id: true,
        userId: true,
        vertical: true,
        provider: true,
        updatedAt: true,
        user: { select: { email: true, name: true, country: true } },
      },
      take: 120,
      orderBy: { updatedAt: "asc" },
    });
    const nowMs = Date.now();
    const waiting = waitingRaw.filter((c) => {
      const wait = waitDaysFor(c.vertical, c.provider);
      return c.updatedAt.getTime() <= nowMs - wait * 86_400_000;
    }).slice(0, 80);

    const OUTREACH_NEEDED_SUBJECT = "זכאי — חסר אימייל לספק כדי להמשיך";
    const MAX_ROUNDS_SUBJECT = "זכאי — סיבובי המעקב מוצו, רשמו תוצאה";
    const MANDATE_INACTIVE_SUBJECT = "זכאי — ה-Mandate לא פעיל, צריך לאשר מחדש";
    let outreachNudges = 0;
    let stuckNudges = 0;
    const seenAgent = new Set<string>();

    async function nudgeOnce(opts: {
      caseId: string;
      userId: string;
      email: string;
      subject: string;
      body: string;
      pushTitle: string;
      pushBody: string;
      tag: string;
    }): Promise<boolean> {
      const recentNudge = await prisma.outbox.findFirst({
        where: {
          caseId: opts.caseId,
          channel: "EMAIL",
          subject: opts.subject,
          createdAt: { gt: sentCooldown },
        },
        select: { id: true },
      });
      if (recentNudge) return false;
      await sendEmail({
        to: opts.email,
        subject: opts.subject,
        body: opts.body,
        caseId: opts.caseId,
      });
      await pushToUser(opts.userId, {
        title: opts.pushTitle,
        body: opts.pushBody,
        url: `/money?case=${opts.caseId}`,
        tag: opts.tag,
      }).catch(() => null);
      return true;
    }

    for (const c of waiting) {
      if (seenAgent.has(c.userId)) continue;

      // Cooldown: any recent agent-marked outbound for this case.
      // Marker is the unified prefix written by autoFollowUpCase.
      const recentOut = await prisma.outbox.findFirst({
        where: {
          caseId: c.id,
          channel: "EMAIL",
          providerMessageId: { not: "inbound" },
          createdAt: { gt: sentCooldown },
          subject: { startsWith: AGENT_SUBJECT_PREFIX },
        },
        select: { id: true },
      });
      if (recentOut) {
        agentSkipped++;
        continue;
      }

      const result = await autoFollowUpCase(c.id);
      if (result.sent) {
        seenAgent.add(c.userId);
        agentFollowUps++;
      } else if (result.reason === "NEEDS_OUTREACH_EMAIL" && c.user.email) {
        const money = `${appUrl}/${localeForCountry(c.user.country)}/money?case=${c.id}`;
        const sent = await nudgeOnce({
          caseId: c.id,
          userId: c.userId,
          email: c.user.email,
          subject: OUTREACH_NEEDED_SUBJECT,
          body: `שלום ${c.user.name},

הסוכן מוכן לשלוח המשך בכתב עם Mandate — אבל חסר אימייל של הספק בתיק.

הזינו כתובת שירות/ביטולים ב״הכסף שלי״ ואשרו שליחה:
${money}

זכאי — הכסף שמגיע לך חוזר אליך.`,
          pushTitle: "חסר אימייל לספק",
          pushBody: "הזינו כתובת ב״הכסף שלי״ כדי שהסוכן יוכל להמשיך.",
          tag: `outreach-needed-${c.id}`,
        });
        if (sent) {
          outreachNudges++;
          seenAgent.add(c.userId);
        }
        agentSkipped++;
      } else if (result.reason === "MAX_ROUNDS" && c.user.email) {
        // FREE maxActiveCases:1 stays frozen on SENT until user records/closes.
        const money = `${appUrl}/${localeForCountry(c.user.country)}/money?case=${c.id}`;
        const sent = await nudgeOnce({
          caseId: c.id,
          userId: c.userId,
          email: c.user.email,
          subject: MAX_ROUNDS_SUBJECT,
          body: `שלום ${c.user.name},

סיבובי המעקב בכתב לתיק הזה מוצו. אל תשלחו עוד תזכורת אוטומטית.

ב״הכסף שלי״ — רשמו סכום מתשובה בכתב, סמנו שלא השתנה, או עברו לנתיב אחר:
${money}

זכאי — הכסף שמגיע לך חוזר אליך.`,
          pushTitle: "סיבובי המעקב מוצו",
          pushBody: "רשמו תוצאה או סגרו את התיק ב״הכסף שלי״.",
          tag: `max-rounds-${c.id}`,
        });
        if (sent) {
          stuckNudges++;
          seenAgent.add(c.userId);
        }
        agentSkipped++;
      } else if (result.reason === "NO_ACTIVE_MANDATE" && c.user.email) {
        const money = `${appUrl}/${localeForCountry(c.user.country)}/money?case=${c.id}`;
        const sent = await nudgeOnce({
          caseId: c.id,
          userId: c.userId,
          email: c.user.email,
          subject: MANDATE_INACTIVE_SUBJECT,
          body: `שלום ${c.user.name},

הסוכן לא יכול להמשיך מול הספק — אין Mandate פעיל על התיק.

פתחו את ״הכסף שלי״, אשרו הרשאה מחדש ושלחו:
${money}

זכאי — הכסף שמגיע לך חוזר אליך.`,
          pushTitle: "Mandate לא פעיל",
          pushBody: "אשרו הרשאה מחדש ב״הכסף שלי״ כדי להמשיך.",
          tag: `mandate-inactive-${c.id}`,
        });
        if (sent) {
          stuckNudges++;
          seenAgent.add(c.userId);
        }
        agentSkipped++;
      } else {
        agentSkipped++;
      }
    }

    // —— 2b. Pre-send rot — APPROVED/VERIFIED waiting without Mandate leave ——
    const PRE_SEND_SUBJECT = "זכאי — תיק ממתין לשליחת Mandate";
    const PRE_SEND_AFTER_DAYS = 1;
    const preSendCutoff = new Date(Date.now() - PRE_SEND_AFTER_DAYS * 86_400_000);
    let preSendNudges = 0;
    const preSendWaiting = await prisma.case.findMany({
      where: {
        status: { in: ["APPROVED", "VERIFIED", "ANALYZED"] },
        updatedAt: { lt: preSendCutoff },
      },
      select: {
        id: true,
        userId: true,
        status: true,
        user: { select: { email: true, name: true, country: true } },
      },
      take: 60,
      orderBy: { updatedAt: "asc" },
    });
    const seenPreSend = new Set<string>();
    for (const c of preSendWaiting) {
      if (seenPreSend.has(c.userId) || !c.user.email) continue;
      seenPreSend.add(c.userId);
      const moneyUrl = `${appUrl}/${localeForCountry(c.user.country)}/money?case=${c.id}`;
      const recent = await prisma.outbox.findFirst({
        where: {
          caseId: c.id,
          channel: "EMAIL",
          subject: PRE_SEND_SUBJECT,
          createdAt: { gt: sentCooldown },
        },
        select: { id: true },
      });
      if (recent) continue;
      await sendEmail({
        to: c.user.email,
        subject: PRE_SEND_SUBJECT,
        body: `שלום ${c.user.name},

יש תיק פתוח שעדיין לא נשלח לספק עם Mandate. דקה אחת ב"הכסף שלי" סוגרת את השלב הזה.

${moneyUrl}

זכאי — הכסף שמגיע לך חוזר אליך.`,
        caseId: c.id,
      });
      await pushToUser(c.userId, {
        title: "תיק ממתין לשליחה",
        body: "המשיכו ב\"הכסף שלי\" — Mandate בכתב, בלי שיחה.",
        url: `/money?case=${c.id}`,
        tag: `pre-send-${c.id}`,
      }).catch(() => null);
      preSendNudges++;
    }

    // —— 3. Personal deadline reminders ——
    // No Case, no Mandate — a plain calendar nudge, reusing this daily cron
    // rather than registering a whole new Vercel cron entry for it.
    const pendingDeadlines = await prisma.deadline.findMany({
      where: { notifiedAt: null },
      include: { user: { select: { email: true, name: true } } },
      take: 500,
    });

    let deadlineNudges = 0;
    for (const d of pendingDeadlines) {
      if (!isReminderDue(d)) continue;
      await sendEmail({
        to: d.user.email,
        subject: `זכאי — תזכורת: ${d.label}`,
        body: `שלום ${d.user.name},

תזכורת: "${d.label}" בתאריך ${d.dueDate.toLocaleDateString("he-IL")}.

זכאי — הכסף שמגיע לך חוזר אליך.`,
      });
      await pushToUser(d.userId, {
        title: "זכאי — תזכורת",
        body: d.label,
        url: "/deadlines",
        tag: `deadline-${d.id}`,
      }).catch(() => null);
      await prisma.deadline.update({ where: { id: d.id }, data: { notifiedAt: new Date() } });
      deadlineNudges++;
    }

    // —— 4. PENDING success fees ——
    const pendingFees = await prisma.fee.findMany({
      where: {
        status: "PENDING",
        amount: { gt: 0 },
        createdAt: { lt: feeCutoff },
      },
      include: {
        case: {
          select: {
            id: true,
            userId: true,
            user: { select: { email: true, name: true, country: true } },
          },
        },
      },
      take: 120,
      orderBy: { createdAt: "asc" },
    });

    const seenFeeUser = new Set<string>();
    for (const fee of pendingFees) {
      const u = fee.case.user;
      if (seenFeeUser.has(fee.case.userId)) continue;

      const recent = await prisma.outbox.findFirst({
        where: {
          toAddress: u.email,
          subject: FEE_NUDGE_SUBJECT,
          createdAt: { gt: feeCooldown },
        },
        select: { id: true },
      });
      if (recent) continue;

      const payUrl = feePayAbsoluteUrl(appUrl, u.country, fee.case.id);
      await sendEmail({
        to: u.email,
        subject: FEE_NUDGE_SUBJECT,
        body: `שלום ${u.name},

תיעדת חיסכון עם זכאי — תודה! נשאר לשלם עמלת הצלחה (רק על מה שנחסך בפועל).

לתשלום מאובטח בלחיצה אחת:
${payUrl}

שאלות או ערעור בתוך 14 יום — השב למייל זה.

זכאי — הכסף שמגיע לך חוזר אליך.`,
        caseId: fee.case.id,
      });
      await pushToUser(fee.case.userId, {
        title: "עמלת הצלחה ממתינה",
        body: "תשלום בלחיצה אחת — רק על חיסכון מתועד.",
        url: feePayDashboardPath(localeForCountry(u.country), fee.case.id),
        tag: `fee-nudge-${fee.case.id}`,
      }).catch(() => null);
      seenFeeUser.add(fee.case.userId);
      feeNudges++;
    }

    return NextResponse.json({
      ok: true,
      savedRecheck: { candidates: staleCases.length, sent: savedSent },
      agentAutoFollowUp: {
        candidates: waiting.length,
        sent: agentFollowUps,
        skipped: agentSkipped,
        outreachEmailNudges: outreachNudges,
        stuckLoopNudges: stuckNudges,
      },
      preSendNudges: { candidates: preSendWaiting.length, sent: preSendNudges },
      deadlineReminders: { candidates: pendingDeadlines.length, sent: deadlineNudges },
      pendingFeeNudges: { candidates: pendingFees.length, sent: feeNudges },
    });
  } catch (err) {
    await reportError(err, { route: "cron-nudges" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
