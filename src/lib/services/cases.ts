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
  beneficiaryLabel?: string;
}

export async function createCase(input: CreateCaseInput) {
  // Enforce the plan's active-case allowance (Free: 1, Pro: 5, Max: unlimited).
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { plan: true },
  });
  const activeCount = await prisma.case.count({
    where: { userId: input.userId, status: { in: [...ACTIVE_CASE_STATUSES] } },
  });
  if (!canOpenCase(user?.plan, activeCount)) throw new CaseError("CASE_LIMIT");

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
      beneficiaryLabel: (input.beneficiaryLabel ?? "").slice(0, 40),
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

  const result = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({
      where: { id: userId },
      select: { plan: true, referralCreditAgorot: true, referredById: true },
    });

    // The success-fee rate comes from the user's plan (Free 18%, Pro 9%, Max 0%),
    // resolved through the vertical's rule pack. Telecom's pack overrides nothing
    // (feeRateBps=null), so this equals the plan rate exactly — the Stage-0
    // invariant — while giving future verticals a per-vertical rate seam.
    const planRateBps = planConfig(owner?.plan).feeRateBps;
    const rateBps = effectiveFeeRateBps(getRulePack("telecom"), planRateBps);
    const fee = computeFee(kase.amountOriginal, newAmount, rateBps);
    const saved = fee.savingMonthly > 0;

    // Apply this user's own referral credit (earned by inviting others) to the
    // gross fee. Net is what we actually charge; unused credit stays on balance.
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
        // PENDING only when there is actually something left to collect; a fee
        // fully covered by plan rate (Max: 0%) or referral credit is WAIVED.
        status: credit.net > 0 ? "PENDING" : "WAIVED",
      },
    });
    if (credit.applied > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { referralCreditAgorot: credit.remainingCredit },
      });
    }

    // If this is the referred user's FIRST documented saving, reward the person
    // who invited them. The unique constraint on referredUserId guarantees at
    // most one reward per referred user, so repeat successes never re-trigger.
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

    // A documented saving is a SAVED case even when the fee is zero (Max plan
    // or referral credit) — the outcome is about the saving, not our fee.
    const updated = await tx.case.update({
      where: { id: caseId },
      data: { status: saved ? "SAVED" : "NO_SAVING" },
    });
    return { case: updated, fee, feeNet: credit.net, creditApplied: credit.applied };
  });

  const fee = result.fee;

  // After the fee is committed, send the customer an automatic confirmation
  // (dev: lands in the Outbox). Only when a fee is actually charged.
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
