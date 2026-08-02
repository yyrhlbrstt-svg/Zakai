import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { formatAgorot } from "@/lib/money";
import { reportError } from "@/lib/report-error";
import { requireCronAuth } from "@/lib/security/cronAuth";

export const dynamic = "force-dynamic";

const DIGEST_SUBJECT = "זכאי — מצב הכסף שלך החודש";
/** Never send two digests within this window (monthly cadence, guarded). */
const DIGEST_COOLDOWN_DAYS = 25;

/**
 * The retention engine's monthly heartbeat. Once a month it emails each active
 * user a short, honest "money status" summary — what Zakai documented, what's
 * still on the table, and open SENT cases waiting on a provider — so a one-time
 * recovery becomes an ongoing relationship. Every number comes from that user's
 * own real cases; nothing is invented.
 *
 * Runs via Vercel Cron (monthly). Guarded by requireCronAuth (fail-closed).
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;

  const cooldown = new Date(Date.now() - DIGEST_COOLDOWN_DAYS * 86_400_000);

  try {
    const users = await prisma.user.findMany({
      where: { cases: { some: {} } },
      select: {
        id: true,
        email: true,
        name: true,
        cases: {
          select: {
            status: true,
            amountOriginal: true,
            targetAmount: true,
            savingsProof: { select: { savingMonthly: true } },
          },
        },
      },
      take: 500,
    });

    let sent = 0;
    for (const u of users) {
      const recent = await prisma.outbox.findFirst({
        where: { toAddress: u.email, subject: DIGEST_SUBJECT, createdAt: { gt: cooldown } },
        select: { id: true },
      });
      if (recent) continue;

      const documentedMonthly = u.cases.reduce(
        (sum, c) => sum + (c.savingsProof?.savingMonthly ?? 0),
        0,
      );
      const potentialMonthly = u.cases.reduce(
        (sum, c) => sum + Math.max(0, c.amountOriginal - c.targetAmount),
        0,
      );
      const openSent = u.cases.filter((c) => c.status === "SENT").length;

      const savedLine =
        documentedMonthly > 0
          ? `עד היום תיעדנו לך חיסכון של ${formatAgorot(documentedMonthly)} בחודש. יפה!`
          : `עדיין לא תיעדנו חיסכון — אבל כל בדיקה מקרבת אותך לשם.`;
      const potentialLine =
        potentialMonthly > 0
          ? `זיהינו פוטנציאל של עד ${formatAgorot(potentialMonthly)} בחודש שעדיין שווה לממש.`
          : "";
      const sentLine =
        openSent > 0
          ? `יש ${openSent} פנייה${openSent > 1 ? "ות" : ""} ממתינות לתשובת ספק — הסוכן ממשיך לעקוב אוטומטית. אם ענו, העבירו את המייל ל-proofs@.`
          : "";

      await sendEmail({
        to: u.email,
        subject: DIGEST_SUBJECT,
        body: `שלום ${u.name},

הנה מצב הכסף שלך בזכאי החודש:

• ${savedLine}
${potentialLine ? `• ${potentialLine}\n` : ""}${sentLine ? `• ${sentLine}\n` : ""}
בישראל מחירים זוחלים למעלה בשקט — דקה של בדיקה חוזרת שווה לפעמים מאות שקלים בשנה. כרגיל, עמלה רק אם יש חיסכון מתועד.

לבדיקה מהירה: היכנסו ל"הכסף שלי" או לדשבורד.

זכאי — הכסף שמגיע לך חוזר אליך.`,
      });
      sent++;
    }

    return NextResponse.json({ ok: true, candidates: users.length, sent });
  } catch (err) {
    await reportError(err, { route: "cron-monthly-digest" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
