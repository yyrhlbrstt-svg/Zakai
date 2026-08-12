import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { formatAgorot } from "@/lib/money";
import { reportError } from "@/lib/report-error";
import { requireCronAuth } from "@/lib/security/cronAuth";
import { closingSoonAcrossUsers } from "@/lib/services/commitments";
import { expiringCouponsAcrossUsers } from "@/lib/services/couponVault";
import { daysUntilExpiry } from "@/lib/coupons";

export const dynamic = "force-dynamic";

/**
 * Three subjects, because the email is titled by what is actually inside it.
 * A person whose only expiring thing is a coupon should not get a message
 * headed "there is a contract you can still get out of" — a subject line that
 * does not match its contents is how a useful alert becomes one people filter.
 */
const SUBJECT_DEADLINES = "זכאי — יש חוזה שאפשר עוד לצאת ממנו";
const SUBJECT_COUPONS = "זכאי — קופונים שעומדים לפוג";
const SUBJECT_BOTH = "זכאי — תאריכים שכדאי לא לפספס";
const ALL_SUBJECTS = [SUBJECT_DEADLINES, SUBJECT_COUPONS, SUBJECT_BOTH];

/**
 * One email per person at a time, however many deadlines it carries. A second
 * message about a third contract in the same week trains people to ignore all
 * of them.
 */
const COOLDOWN_DAYS = 7;

/**
 * The part that works while nobody is looking.
 *
 * A contract renews on 1 January and requires sixty days' notice, so the date
 * that decides whether it rolls for another year is 1 November — and that date
 * appears nowhere. Not in the contract's headline, not in a calendar, not in
 * any reminder anyone sets. Missing it by a day costs a full term at a price
 * nobody agreed to now.
 *
 * WHY THIS IS NOT FOLDED INTO THE MONTHLY DIGEST
 *
 * The digest is a retention heartbeat and monthly is right for it. A notice
 * window is not a heartbeat: `CLOSING_SOON_DAYS` is fourteen, so a monthly
 * cadence would miss roughly half of them entirely. Weekly is the slowest
 * schedule that cannot skip one.
 *
 * It stays quiet otherwise. Nothing is sent to somebody with no deadline in
 * range — this is an alert with a date on it, not a second newsletter, and an
 * alert that arrives when nothing is wrong stops being read before the one
 * that matters arrives.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const cooldown = new Date(now.getTime() - COOLDOWN_DAYS * 86_400_000);

  try {
    // One person, one email, however many kinds of date they are carrying.
    // Two separate weekly crons would mean two emails in the same hour, which
    // is the fastest way to get both of them ignored.
    const [byUser, couponsByUser] = await Promise.all([
      closingSoonAcrossUsers(now),
      expiringCouponsAcrossUsers(now).catch(() => new Map<string, never[]>()),
    ]);
    const userIds = [...new Set([...byUser.keys(), ...couponsByUser.keys()])];
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, users: 0, sent: 0 });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });

    let sent = 0;
    for (const user of users) {
      const recent = await prisma.outbox.findFirst({
        where: {
          toAddress: user.email,
          subject: { in: ALL_SUBJECTS },
          createdAt: { gt: cooldown },
        },
        select: { id: true },
      });
      if (recent) continue;

      const items = byUser.get(user.id) ?? [];
      const coupons = couponsByUser.get(user.id) ?? [];
      if (items.length === 0 && coupons.length === 0) continue;

      const lines = items.map((c) => {
        const actBy = c.window.actBy?.toISOString().slice(0, 10) ?? "";
        const cost =
          c.monthlyMinor !== null && c.monthlyMinor > 0
            ? ` · ${formatAgorot(c.monthlyMinor, "he-IL")} לחודש`
            : "";
        // A passed deadline is the most important line here, not one to hide:
        // the person still has to decide what to do about a term that is now
        // rolling, and telling them late beats not telling them.
        return c.window.state === "missed"
          ? `• ${c.label}${cost} — חלון ההודעה נסגר ב-${actBy}. החוזה מתחדש; עדיין אפשר לבקש ביטול או תנאים חדשים.`
          : `• ${c.label}${cost} — צריך להודיע בכתב עד ${actBy} (נותרו ${c.window.daysLeft} ימים).`;
      });

      const couponLines = coupons.map((c) => {
        const left = daysUntilExpiry(c, now);
        const value =
          c.percentOff !== null
            ? ` · ${c.percentOff}% הנחה`
            : c.amountMinor !== null
              ? ` · ${formatAgorot(c.amountMinor, "he-IL")} הנחה`
              : "";
        return `• ${c.merchant}${value} — פג בעוד ${left} ימים.`;
      });

      const subject =
        items.length > 0 && coupons.length > 0
          ? SUBJECT_BOTH
          : items.length > 0
            ? SUBJECT_DEADLINES
            : SUBJECT_COUPONS;

      await sendEmail({
        to: user.email,
        subject,
        body: [
          `שלום ${user.name},`,
          ...(items.length > 0
            ? [
                "",
                "יש התחייבות אחת או יותר שאפשר עוד לפעול לגביה. התאריכים כאן הם תאריכי ההודעה מראש — לא תאריכי החידוש, שהם כבר מאוחר מדי:",
                "",
                ...lines,
              ]
            : []),
          ...(coupons.length > 0
            ? [
                "",
                "קופונים שלך שעומדים לפוג:",
                "",
                ...couponLines,
                "",
                "הקודים עצמם נמצאים בכספת שלך בזכאי — לא שולחים אותם במייל.",
              ]
            : []),
          "",
          "אנחנו מחזיקים את התאריכים האלה כדי שלא תצטרכו לזכור אותם. אם משהו כאן כבר לא רלוונטי, סמנו אותו בזכאי.",
          "",
          "זכאי",
        ].join("\n"),
      });
      sent += 1;
    }

    return NextResponse.json({ ok: true, users: users.length, sent });
  } catch (err) {
    await reportError(err, { route: "cron/deadline-watch" });
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}
