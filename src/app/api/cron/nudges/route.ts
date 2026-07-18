import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { RECHECK_AFTER_DAYS } from "@/lib/insights";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

const NUDGE_SUBJECT = "זכאי — המבצע שלך כנראה נגמר, שווה לבדוק שוב";
/** Don't nudge the same user more often than this. */
const NUDGE_COOLDOWN_DAYS = 60;

/**
 * The retention engine's outbound half (the in-app half lives in the
 * insights). Runs daily via Vercel Cron: finds users whose documented
 * saving is older than the typical promo window and emails a re-check
 * nudge — at most one per user per cooldown window. Messages go through
 * the Outbox (real delivery activates once SMTP is configured).
 *
 * Guarded by CRON_SECRET when set (Vercel sends it as a Bearer token).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - RECHECK_AFTER_DAYS * 86_400_000);
  const cooldown = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 86_400_000);

  try {
    const staleCases = await prisma.case.findMany({
      where: { status: "SAVED", savingsProof: { recordedAt: { lt: cutoff } } },
      select: { userId: true, user: { select: { email: true, name: true } } },
      take: 200,
    });

    // One nudge per user, and only if none was sent within the cooldown.
    const seen = new Set<string>();
    let sent = 0;
    for (const c of staleCases) {
      if (seen.has(c.userId)) continue;
      seen.add(c.userId);

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

בדיקה חוזרת לוקחת דקה: מעלים חשבונית עדכנית, וזכאי בודק אם המחיר זחל למעלה ופועל אם צריך. כרגיל — עמלה רק אם יש חיסכון מתועד.

לבדיקה חוזרת: היכנסו לחשבון ובחרו "בדיקה חדשה".

זכאי — הכסף שמגיע לך חוזר אליך.`,
      });
      sent++;
    }

    return NextResponse.json({ ok: true, candidates: staleCases.length, sent });
  } catch (err) {
    await reportError(err, { route: "cron-nudges" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
