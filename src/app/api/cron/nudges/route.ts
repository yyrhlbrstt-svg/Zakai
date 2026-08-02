import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { pushToUser } from "@/lib/push";
import { RECHECK_AFTER_DAYS } from "@/lib/insights";
import { reportError } from "@/lib/report-error";
import { AGENT_SUBJECT_PREFIX, autoFollowUpCase } from "@/lib/services/agentFollowUp";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { isReminderDue } from "@/lib/deadlines";

export const dynamic = "force-dynamic";

const NUDGE_SUBJECT = "זכאי — המבצע שלך כנראה נגמר, שווה לבדוק שוב";
/** Don't nudge the same user more often than this for SAVED recheck. */
const NUDGE_COOLDOWN_DAYS = 60;
/** SENT cases older than this get an agent auto-follow-up (round 2+ to provider). */
const SENT_AFTER_DAYS = 5;
const SENT_COOLDOWN_DAYS = 12;

/**
 * Daily cron (Vercel):
 * 1) SAVED cases past promo window → re-check nudge to user
 * 2) SENT cases waiting 5+ days → AGENT auto-follow-up to the provider
 *    (Mandate-backed, written, no phone, no human).
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const cutoff = new Date(Date.now() - RECHECK_AFTER_DAYS * 86_400_000);
  const cooldown = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 86_400_000);
  const sentCutoff = new Date(Date.now() - SENT_AFTER_DAYS * 86_400_000);
  const sentCooldown = new Date(Date.now() - SENT_COOLDOWN_DAYS * 86_400_000);

  try {
    let savedSent = 0;
    let agentFollowUps = 0;
    let agentSkipped = 0;

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

לבדיקה: היכנסו ל"הכסף שלי" או לדשבורד.

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
        url: "/dashboard",
        tag: "recheck-nudge",
      });
      savedSent++;
    }

    // —— 2. AGENT auto-follow-up on SENT cases ——
    const waiting = await prisma.case.findMany({
      where: {
        status: "SENT",
        updatedAt: { lt: sentCutoff },
        authorization: { status: "ACTIVE" },
        ownershipVerifiedAt: { not: null },
      },
      select: { id: true, userId: true },
      take: 80,
      orderBy: { updatedAt: "asc" },
    });

    const seenAgent = new Set<string>();
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
      } else {
        agentSkipped++;
      }
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

    return NextResponse.json({
      ok: true,
      savedRecheck: { candidates: staleCases.length, sent: savedSent },
      agentAutoFollowUp: {
        candidates: waiting.length,
        sent: agentFollowUps,
        skipped: agentSkipped,
      },
      deadlineReminders: { candidates: pendingDeadlines.length, sent: deadlineNudges },
    });
  } catch (err) {
    await reportError(err, { route: "cron-nudges" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
