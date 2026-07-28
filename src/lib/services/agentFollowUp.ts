import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { buildFollowUp } from "@/lib/negotiation";
import { providerContactEmail, providerHebrewName } from "@/lib/providers";
import { agorotToShekels } from "@/lib/money";
import { pushToUser } from "@/lib/push";

/**
 * The agent keeps working after the first send.
 *
 * When a SENT case sits without a recorded reply for several business days,
 * this service builds the next written follow-up (deterministic playbook),
 * attaches the live Mandate footer, and dispatches to the provider.
 *
 * Hard gates (same as first send):
 *  - Case status SENT
 *  - ACTIVE Authorization still present
 *  - Ownership already verified
 *
 * The user is never asked for a phone number. They can revoke the Mandate
 * at any time; the next cron pass simply skips revoked cases.
 *
 * This is the difference between a letter-template tool and a real agent:
 * the case continues without the founder or the customer opening the app.
 */

export interface AutoFollowUpResult {
  caseId: string;
  sent: boolean;
  reason?: string;
}

export async function autoFollowUpCase(caseId: string): Promise<AutoFollowUpResult> {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      authorization: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!kase) return { caseId, sent: false, reason: "NOT_FOUND" };
  if (kase.status !== "SENT") return { caseId, sent: false, reason: "NOT_SENT" };
  if (!kase.ownershipVerifiedAt) return { caseId, sent: false, reason: "NO_OWNERSHIP" };
  if (!kase.authorization || kase.authorization.status !== "ACTIVE") {
    return { caseId, sent: false, reason: "NO_ACTIVE_MANDATE" };
  }

  const auth = kase.authorization;
  const provider = providerHebrewName(kase.provider);
  const follow = buildFollowUp({
    customerName: kase.user.name,
    providerLabel: provider,
    amountOriginalShekels: agorotToShekels(kase.amountOriginal),
    targetShekels: agorotToShekels(kase.targetAmount),
    plan: kase.planDescription || undefined,
    replyKind: "delay",
    round: 2,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const footer = `

————————————————————————
מסמך הרשאה (ייפוי כוח) — שירות זכאי
מיופה כוח: זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם הלקוח/ה ${auth.principalName} בהרשאתו/ה.
קוד אימות ההרשאה: ${auth.code}
לאימות ההרשאה: ${appUrl}/verify?code=${auth.code}
גילוי: זכאי אינו הלקוח/ה. ניתן ליצור קשר עם הלקוח/ה ישירות.
זוהי פנייה חוזרת אוטומטית של הסוכן (סיבוב 2) — הלקוח/ה לא נדרש/ת לפעולה נוספת.`;

  await sendEmail({
    to: providerContactEmail(kase.provider),
    subject: follow.subject,
    body: follow.body + footer,
    caseId,
  });

  // Bump updatedAt so the next cron window does not re-send immediately.
  await prisma.case.update({
    where: { id: caseId },
    data: { updatedAt: new Date() },
  });

  // Notify the customer that the agent acted (self-serve transparency).
  await sendEmail({
    to: kase.user.email,
    subject: `זכאי — הסוכן שלח תזכורת ל-${provider}`,
    body: `שלום ${kase.user.name},

עברו כמה ימים בלי תשובה מ-${provider}. הסוכן שלח בשמך פנייה חוזרת בכתב (סיבוב 2), עם מסמך ההרשאה הפעיל.

מה אפשר לעשות עכשיו בדשבורד:
• אם ענו — הזינו את הסכום החדש ולחצו "רשום חיסכון".
• אם רוצים לעצור — בטלו את ההרשאה במסמך האימות.

הכול בתוך זכאי. עמלה רק על חיסכון מתועד.

זכאי — הסוכן שלך.`,
    caseId,
  });

  // Push to installed PWA if the user opted in — agent feels alive on the phone.
  await pushToUser(kase.user.id, {
    title: "זכאי — הסוכן פעל",
    body: `נשלחה תזכורת ל-${provider}. פתחו את הדשבורד אם ענו.`,
    url: "/he/dashboard",
    tag: `followup-${caseId}`,
  }).catch(() => null);

  return { caseId, sent: true };
}
