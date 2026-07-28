import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { RECHECK_AFTER_DAYS } from "@/lib/insights";
import { reportError } from "@/lib/report-error";
import { autoFollowUpCase } from "@/lib/services/agentFollowUp";

export const dynamic = "force-dynamic";

const NUDGE_SUBJECT = "זכאי — המבצע שלך כנראה נגמר, שווה לבדוק שוב";
/** Don't nudge the same user more often than this for SAVED recheck. */
const NUDGE_COOLDOWN_DAYS = 60;
/** SENT cases older than this get an agent auto-follow-up (round 2 to provider). */
const SENT_AFTER_DAYS = 5;
const SENT_COOLDOWN_DAYS = 12;

/**
 * Daily cron (Vercel):
 * 1) SAVED cases past promo window → re-check nudge to user
 * 2) SENT cases waiting 5+ days → AGENT auto-follow-up to the provider
 *    (Mandate-backed, written, no phone, no human). This is the leap from
 *    "tools the user copies" to "agent that keeps negotiating".
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
      savedSent++;
    }

    // —— 2. AGENT auto-follow-up on SENT cases ——
    // The agent itself writes and sends round-2 to the provider when Mandate is live.
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
      // Cap one auto-follow-up action per user per cooldown to avoid flooding.
      if (seenAgent.has(c.userId)) continue;

      // Skip if we already auto-sent a round-2 style message for this case recently.
      const recentOut = await prisma.outbox.findFirst({
        where: {
          caseId: c.id,
          subject: { contains: "המשך פנייה" },
          createdAt: { gt: sentCooldown },
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

    return NextResponse.json({
      ok: true,
      savedRecheck: { candidates: staleCases.length, sent: savedSent },
      agentAutoFollowUp: {
        candidates: waiting.length,
        sent: agentFollowUps,
        skipped: agentSkipped,
      },
    });
  } catch (err) {
    await reportError(err, { route: "cron-nudges" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
