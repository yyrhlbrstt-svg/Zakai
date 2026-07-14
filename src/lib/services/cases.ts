import "server-only";
import { prisma } from "@/lib/prisma";
import { shekelsToAgorot, formatAgorot } from "@/lib/money";
import { computeFee } from "@/lib/fee";
import { sendEmail } from "@/lib/messaging";
import { providerContactEmail, providerHebrewName } from "@/lib/providers";
import { createAuthorization } from "./authorization";

export class CaseError extends Error {}

/** Days a customer has to dispute a success-fee charge (see Trust page). */
export const FEE_DISPUTE_WINDOW_DAYS = 14;

function supportEmail(): string {
  return process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@zakai.example";
}

interface CreateCaseInput {
  userId: string;
  provider: string;
  amountShekels: number;
  plan: string;
  strategy: string;
  targetShekels: number;
  marketLowShekels?: number;
  marketHighShekels?: number;
  draftMessage: string;
}

export async function createCase(input: CreateCaseInput) {
  return prisma.case.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      planDescription: input.plan,
      amountOriginal: shekelsToAgorot(input.amountShekels),
      targetAmount: shekelsToAgorot(input.targetShekels),
      marketLow: input.marketLowShekels != null ? shekelsToAgorot(input.marketLowShekels) : null,
      marketHigh: input.marketHighShekels != null ? shekelsToAgorot(input.marketHighShekels) : null,
      strategy: input.strategy,
      draftMessage: input.draftMessage,
      status: "ANALYZED",
    },
  });
}

/** Load a case that must belong to the given user, or throw. */
async function ownedCase(caseId: string, userId: string) {
  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase || kase.userId !== userId) throw new CaseError("NOT_FOUND");
  return kase;
}

/**
 * Record the user's explicit, per-request consent to the drafted outreach.
 * The (optionally edited) message is what the user is consenting to.
 */
export async function approveCase(caseId: string, userId: string, editedMessage?: string) {
  const kase = await ownedCase(caseId, userId);
  return prisma.case.update({
    where: { id: kase.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      ...(editedMessage ? { draftMessage: editedMessage } : {}),
    },
  });
}

/**
 * If both trust gates are satisfied — ownership verified AND an active
 * authorization document exists — advance the case to VERIFIED.
 */
export async function refreshVerifiedStatus(caseId: string) {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { authorization: true },
  });
  if (!kase) return;
  const ready =
    kase.ownershipVerifiedAt != null &&
    kase.authorization != null &&
    kase.authorization.status === "ACTIVE" &&
    (kase.status === "APPROVED" || kase.status === "ANALYZED");
  if (ready) {
    await prisma.case.update({ where: { id: caseId }, data: { status: "VERIFIED" } });
  }
}

/**
 * Dispatch the outreach to the provider. Hard-gated: the case must be verified,
 * ownership confirmed, and an ACTIVE authorization must exist. The final email
 * is the approved body plus a fixed authorization footer carrying the
 * verifiable code and the agent disclosure.
 */
export async function sendOutreach(caseId: string, userId: string) {
  const kase = await ownedCase(caseId, userId);
  const auth = await prisma.authorization.findUnique({ where: { caseId } });

  if (!kase.ownershipVerifiedAt) throw new CaseError("OWNERSHIP_REQUIRED");
  if (!auth || auth.status !== "ACTIVE") throw new CaseError("AUTHORIZATION_REQUIRED");
  if (kase.status === "SENT" || kase.status === "SAVED" || kase.status === "NO_SAVING") {
    throw new CaseError("ALREADY_SENT");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const footer = `

————————————————————————
מסמך הרשאה (ייפוי כוח) — שירות זכאי
מיופה כוח: זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם הלקוח/ה ${auth.principalName} בהרשאתו/ה.
קוד אימות ההרשאה: ${auth.code}
לאימות ההרשאה: ${appUrl}/verify?code=${auth.code}
גילוי: זכאי אינו הלקוח/ה. ניתן ליצור קשר עם הלקוח/ה ישירות.`;

  const email = await sendEmail({
    to: providerContactEmail(kase.provider),
    subject: `בקשת התאמת מסלול בשם ${auth.principalName} — הרשאה ${auth.code}`,
    body: kase.draftMessage + footer,
    caseId,
  });

  await prisma.case.update({ where: { id: caseId }, data: { status: "SENT" } });
  return email;
}

/**
 * Record the provider's reply as an append-only proof of savings, and derive
 * the fee. A fee is created ONLY when a positive saving is documented; a
 * non-saving still records a proof (audit trail) and a WAIVED fee.
 * Idempotent guard: a case can only be settled once.
 */
export async function recordSaving(caseId: string, userId: string, newAmountShekels: number) {
  const kase = await ownedCase(caseId, userId);
  if (kase.status !== "SENT") throw new CaseError("NOT_SENT");

  const existing = await prisma.savingsProof.findUnique({ where: { caseId } });
  if (existing) throw new CaseError("ALREADY_SETTLED");

  const newAmount = shekelsToAgorot(newAmountShekels);
  const fee = computeFee(kase.amountOriginal, newAmount);

  const result = await prisma.$transaction(async (tx) => {
    await tx.savingsProof.create({
      data: {
        caseId,
        originalAmount: kase.amountOriginal,
        newAmount,
        savingMonthly: fee.savingMonthly,
        source: "manual",
      },
    });
    await tx.fee.create({
      data: {
        caseId,
        savingMonthly: fee.savingMonthly,
        rateBps: fee.rateBps,
        amount: fee.amount,
        status: fee.chargeable ? "PENDING" : "WAIVED",
      },
    });
    const updated = await tx.case.update({
      where: { id: caseId },
      data: { status: fee.chargeable ? "SAVED" : "NO_SAVING" },
    });
    return { case: updated, fee };
  });

  // After the fee is committed, send the customer an automatic confirmation
  // (dev: lands in the Outbox). Only when a fee is actually charged.
  if (fee.chargeable) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (user) {
      await sendEmail({
        to: user.email,
        subject: `זכאי — אישור חיסכון ועמלת הצלחה (${providerHebrewName(kase.provider)})`,
        body: feeConfirmationBody({
          name: user.name,
          provider: kase.provider,
          originalAgorot: kase.amountOriginal,
          newAgorot: newAmount,
          savingAgorot: fee.savingMonthly,
          feeAgorot: fee.amount,
        }),
        caseId,
      });
    }
  }

  return result;
}

function feeConfirmationBody(p: {
  name: string;
  provider: string;
  originalAgorot: number;
  newAgorot: number;
  savingAgorot: number;
  feeAgorot: number;
}): string {
  const f = (a: number) => formatAgorot(a, "he-IL");
  return `שלום ${p.name},

תיעדנו חיסכון בפנייה שביצע זכאי בשמך מול ${providerHebrewName(p.provider)}, ובהתאם למודל עמלת ההצלחה נגבית עמלה של 18% מהחיסכון המתועד בלבד.

פירוט:
• סכום חודשי מקורי: ${f(p.originalAgorot)}
• סכום חודשי חדש: ${f(p.newAgorot)}
• חיסכון חודשי מתועד: ${f(p.savingAgorot)}
• עמלת הצלחה (18%): ${f(p.feeAgorot)}

ערעור על החיוב: אם לדעתך החיסכון לא מומש בפועל, יש לך ${FEE_DISPUTE_WINDOW_DAYS} ימים מתאריך הודעה זו לפנות אלינו לבדיקה, ואם יתברר שהחיסכון לא נכנס לתוקף — העמלה תבוטל או תוחזר. לפנייה: ${supportEmail()}

זכאי הוא שירות סוכן דיגיטלי אוטומטי הפועל מטעמך בהרשאתך. אין באמור ייעוץ משפטי, פיננסי או ביטוחי.

בברכה,
צוות זכאי`;
}
