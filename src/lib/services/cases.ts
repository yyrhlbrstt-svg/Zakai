import "server-only";
import { prisma } from "@/lib/prisma";
import { shekelsToAgorot, formatAgorot } from "@/lib/money";
import { computeFee } from "@/lib/fee";
import { getRulePack, effectiveFeeRateBps } from "@/lib/verticals";
import { planConfig, canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { applyCredit, REFERRAL_REWARD_AGOROT } from "@/lib/referral";
import { sendEmail } from "@/lib/messaging";
import { providerContactEmail, providerHebrewName } from "@/lib/providers";
import { createAuthorization } from "./authorization";
import { recordOutcome, daysBetween } from "@/lib/strategy/store";
import { mandateEmailAttachment } from "@/lib/mandate/document";
import { maskPhone } from "@/lib/phone";

export class CaseError extends Error {}

/** Days a customer has to dispute a success-fee charge (see Trust page). */
export const FEE_DISPUTE_WINDOW_DAYS = 14;

function marketForCase(vertical: string): string {
  return getRulePack(vertical)?.country ?? "IL";
}

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
  beneficiaryLabel?: string;
  vertical?: string;
  strategyVariant?: string;
  strategySeed?: number;
  autoApprove?: boolean;
}

export async function createCase(input: CreateCaseInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { plan: true },
  });
  const activeCount = await prisma.case.count({
    where: { userId: input.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user?.plan, activeCount)) throw new CaseError("CASE_LIMIT");

  const now = new Date();
  return prisma.case.create({
    data: {
      userId: input.userId,
      vertical: input.vertical ?? "telecom",
      provider: input.provider,
      planDescription: input.plan,
      amountOriginal: shekelsToAgorot(input.amountShekels),
      targetAmount: shekelsToAgorot(input.targetShekels),
      marketLow: input.marketLowShekels != null ? shekelsToAgorot(input.marketLowShekels) : null,
      marketHigh: input.marketHighShekels != null ? shekelsToAgorot(input.marketHighShekels) : null,
      strategy: input.strategy,
      draftMessage: input.draftMessage,
      beneficiaryLabel: (input.beneficiaryLabel ?? "").slice(0, 40),
      strategyVariant: input.strategyVariant ?? null,
      strategySeed: input.strategySeed ?? null,
      status: input.autoApprove ? "APPROVED" : "ANALYZED",
      approvedAt: input.autoApprove ? now : null,
    },
  });
}

async function ownedCase(caseId: string, userId: string) {
  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase || kase.userId !== userId) throw new CaseError("NOT_FOUND");
  return kase;
}

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
 * Dispatch the outreach to the provider. Hard-gated: ownership + ACTIVE
 * authorization. Mandate HTML is attached so the provider has a printable
 * document without leaving their inbox.
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
מצורף: מסמך הרשאה מלא (HTML) להדפסה/שמירה.
גילוי: זכאי אינו הלקוח/ה. ניתן ליצור קשר עם הלקוח/ה ישירות.`;

  const attachment = mandateEmailAttachment({
    code: auth.code,
    principalName: auth.principalName,
    principalContact: maskPhone(auth.principalPhone),
    provider: auth.provider,
    scope: auth.scope,
    issuedAt: auth.issuedAt,
    status: auth.status,
  });

  const email = await sendEmail({
    to: providerContactEmail(kase.provider),
    subject: `בקשת התאמת מסלול בשם ${auth.principalName} — הרשאה ${auth.code}`,
    body: kase.draftMessage + footer,
    caseId,
    attachments: [attachment],
  });

  await prisma.case.update({ where: { id: caseId }, data: { status: "SENT" } });
  return email;
}

export async function recordSaving(caseId: string, userId: string, newAmountShekels: number) {
  const kase = await ownedCase(caseId, userId);
  if (kase.status !== "SENT") throw new CaseError("NOT_SENT");

  const existing = await prisma.savingsProof.findUnique({ where: { caseId } });
  if (existing) throw new CaseError("ALREADY_SETTLED");

  const newAmount = shekelsToAgorot(newAmountShekels);

  const result = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({
      where: { id: userId },
      select: { plan: true, referralCreditAgorot: true, referredById: true },
    });

    const planRateBps = planConfig(owner?.plan).feeRateBps;
    const rateBps = effectiveFeeRateBps(getRulePack(kase.vertical), planRateBps);
    const fee = computeFee(kase.amountOriginal, newAmount, rateBps);
    const saved = fee.savingMonthly > 0;

    const credit = applyCredit(fee.amount, owner?.referralCreditAgorot ?? 0);

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
        amount: credit.net,
        referralCreditApplied: credit.applied,
        status: credit.net > 0 ? "PENDING" : "WAIVED",
      },
    });
    if (credit.applied > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { referralCreditAgorot: credit.remainingCredit },
      });
    }

    if (saved && owner?.referredById) {
      const already = await tx.referralReward.findUnique({
        where: { referredUserId: userId },
      });
      if (!already) {
        await tx.referralReward.create({
          data: {
            referrerId: owner.referredById,
            referredUserId: userId,
            triggeringCaseId: caseId,
            amountAgorot: REFERRAL_REWARD_AGOROT,
          },
        });
        await tx.user.update({
          where: { id: owner.referredById },
          data: { referralCreditAgorot: { increment: REFERRAL_REWARD_AGOROT } },
        });
      }
    }

    const updated = await tx.case.update({
      where: { id: caseId },
      data: { status: saved ? "SAVED" : "NO_SAVING" },
    });
    return { case: updated, fee, feeNet: credit.net, creditApplied: credit.applied };
  });

  const fee = result.fee;

  await recordOutcome({
    context: {
      market: marketForCase(kase.vertical),
      vertical: kase.vertical,
      counterparty: kase.provider,
    },
    variantId: kase.strategyVariant,
    paid: fee.savingMonthly > 0,
    recoveredMinor: fee.savingMonthly * 12,
    days: daysBetween(kase.approvedAt ?? kase.createdAt, new Date()),
  });

  if (result.feeNet > 0) {
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
          rateBps: fee.rateBps,
          grossFeeAgorot: fee.amount,
          creditAgorot: result.creditApplied,
          netFeeAgorot: result.feeNet,
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
  rateBps: number;
  grossFeeAgorot: number;
  creditAgorot: number;
  netFeeAgorot: number;
}): string {
  const f = (a: number) => formatAgorot(a, "he-IL");
  const pct = `${(p.rateBps / 100).toLocaleString("he-IL", { maximumFractionDigits: 2 })}%`;
  const creditLines =
    p.creditAgorot > 0
      ? `• עמלת הצלחה (${pct}): ${f(p.grossFeeAgorot)}
• זיכוי חבר מביא חבר: −${f(p.creditAgorot)}
• סה"כ לחיוב: ${f(p.netFeeAgorot)}`
      : `• עמלת הצלחה (${pct}): ${f(p.netFeeAgorot)}`;
  return `שלום ${p.name},

תיעדנו חיסכון בפנייה שביצע זכאי בשמך מול ${providerHebrewName(p.provider)}, ובהתאם למסלול שלך נגבית עמלת הצלחה של ${pct} מהחיסכון המתועד בלבד.

פירוט:
• סכום חודשי מקורי: ${f(p.originalAgorot)}
• סכום חודשי חדש: ${f(p.newAgorot)}
• חיסכון חודשי מתועד: ${f(p.savingAgorot)}
${creditLines}

ערעור על החיוב: אם לדעתך החיסכון לא מומש בפועל, יש לך ${FEE_DISPUTE_WINDOW_DAYS} ימים מתאריך הודעה זו לפנות אלינו לבדיקה, ואם יתברר שהחיסכון לא נכנס לתוקף — העמלה תבוטל או תוחזר. לפנייה: ${supportEmail()}

זכאי הוא שירות סוכן דיגיטלי אוטומטי הפועל מטעמך בהרשאתך. אין באמור ייעוץ משפטי, פיננסי או ביטוחי.

בברכה,
צוות זכאי`;
}
