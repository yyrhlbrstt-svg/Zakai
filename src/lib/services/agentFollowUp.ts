import "server-only";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { buildFollowUp } from "@/lib/negotiation";
import { buildAirlineFollowUp } from "@/lib/flightNegotiation";
import { providerHebrewName } from "@/lib/providers";
import { resolveCaseOutreachTo } from "@/lib/caseOutreach";
import { agorotToShekels } from "@/lib/money";
import { pushToUser } from "@/lib/push";
import { mandateEmailAttachment, proofsInboundAddress } from "@/lib/mandate/document";
import { maskPhone } from "@/lib/phone";

/**
 * The agent keeps working after the first send.
 *
 * When a SENT case sits without a recorded reply for several business days,
 * this service builds the next written follow-up (deterministic playbook),
 * attaches the live Mandate document, and dispatches to the provider.
 *
 * Round tracking is explicit: we count prior agent follow-ups on the Outbox
 * (subject prefix "זכאי סיבוב N") and increment. Cap at round 4 so we never
 * spam a provider indefinitely.
 */

export const AGENT_SUBJECT_PREFIX = "זכאי סיבוב";
export const MAX_AGENT_ROUNDS = 4;

export interface AutoFollowUpResult {
  caseId: string;
  sent: boolean;
  round?: number;
  reason?: string;
}

/** Count prior agent auto-follow-ups for this case (by subject marker). */
async function priorAgentRounds(caseId: string): Promise<number> {
  const rows = await prisma.outbox.findMany({
    where: {
      caseId,
      channel: "EMAIL",
      providerMessageId: { not: "inbound" },
      subject: { startsWith: AGENT_SUBJECT_PREFIX },
    },
    select: { subject: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.length;
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

  const prior = await priorAgentRounds(caseId);
  const round = prior + 2; // first outreach = round 1 (manual/send); auto starts at 2
  if (round > MAX_AGENT_ROUNDS) {
    return { caseId, sent: false, reason: "MAX_ROUNDS", round };
  }

  const auth = kase.authorization;
  const provider = providerHebrewName(kase.provider);
  const follow =
    kase.vertical === "airline"
      ? buildAirlineFollowUp({
          customerName: kase.user.name,
          providerLabel: provider,
          amountOriginalShekels: agorotToShekels(kase.amountOriginal),
          targetShekels: agorotToShekels(kase.targetAmount),
          plan: kase.planDescription || undefined,
          replyKind: "delay",
          round,
        })
      : buildFollowUp({
          customerName: kase.user.name,
          providerLabel: provider,
          amountOriginalShekels: agorotToShekels(kase.amountOriginal),
          targetShekels: agorotToShekels(kase.targetAmount),
          plan: kase.planDescription || undefined,
          replyKind: "delay",
          round,
        });

  const subject = `${AGENT_SUBJECT_PREFIX} ${round} — תזכורת ל-${provider} | ${kase.user.name}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const footer = `

————————————————————————
מסמך הרשאה (ייפוי כוח) — שירות זכאי
מיופה כוח: זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם הלקוח/ה ${auth.principalName} בהרשאתו/ה.
קוד אימות ההרשאה: ${auth.code}
לאימות ההרשאה: ${appUrl}/verify?code=${auth.code}
מצורף: מסמך הרשאה מלא (HTML).
גילוי: זכאי אינו הלקוח/ה. ניתן ליצור קשר עם הלקוח/ה ישירות.
זוהי פנייה חוזרת אוטומטית של הסוכן (סיבוב ${round}) — הלקוח/ה לא נדרש/ת לפעולה נוספת.`;

  const attachment = mandateEmailAttachment({
    code: auth.code,
    principalName: auth.principalName,
    principalContact: maskPhone(auth.principalPhone),
    provider: auth.provider,
    scope: auth.scope,
    issuedAt: auth.issuedAt,
    status: auth.status,
  });

  const to = resolveCaseOutreachTo(kase);
  if (!to) {
    return { caseId, sent: false, reason: "NEEDS_OUTREACH_EMAIL" };
  }

  await sendEmail({
    to,
    subject,
    body: follow.body + footer,
    caseId,
    attachments: [attachment],
  });

  await prisma.case.update({
    where: { id: caseId },
    data: { updatedAt: new Date() },
  });

  const proofsAddr = proofsInboundAddress();
  await sendEmail({
    to: kase.user.email,
    subject: `זכאי — הסוכן שלח תזכורת ל-${provider} (סיבוב ${round})`,
    body: `שלום ${kase.user.name},

עברו כמה ימים בלי תשובה מ-${provider}. הסוכן שלח בשמך פנייה חוזרת בכתב (סיבוב ${round}), עם מסמך ההרשאה הפעיל מצורף.

מה אפשר לעשות עכשיו:
• אם ענו — העבירו את המייל שלהם אל ${proofsAddr} (או הזינו סכום חדש בדשבורד).
• אם רוצים לעצור — בטלו את ההרשאה במסמך האימות.

הכול בתוך זכאי. עמלה רק על חיסכון מתועד.

זכאי — הסוכן שלך.`,
    caseId,
  });

  await pushToUser(kase.user.id, {
    title: "זכאי — הסוכן פעל",
    body: `סיבוב ${round}: נשלחה תזכורת ל-${provider}. פתחו את הדשבורד אם ענו.`,
    url: "/dashboard",
    tag: `followup-${caseId}-r${round}`,
  }).catch(() => null);

  return { caseId, sent: true, round };
}
