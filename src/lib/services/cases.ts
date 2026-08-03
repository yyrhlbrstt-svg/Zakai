import "server-only";
import { prisma } from "@/lib/prisma";
import { shekelsToAgorot, formatAgorot } from "@/lib/money";
import { computeCaseSuccessFee, documentedRecoveryMinor } from "@/lib/fee";
import { getRulePack, effectiveFeeRateBps } from "@/lib/verticals";
import { planConfig, canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { applyCredit, REFERRAL_REWARD_AGOROT } from "@/lib/referral";
import { sendEmail } from "@/lib/messaging";
import { providerHebrewName } from "@/lib/providers";
import { resolveCaseOutreachTo } from "@/lib/caseOutreach";
import { createAuthorization, ensureMandateTokenForCase } from "./authorization";
import { stampOwnershipFromVerifiedEmail } from "./ownership";
import { loadSigningKeyFromEnv, MandateKeyUnavailableError } from "@/lib/mandate/mandate";
import {
  buildInboundReceivePayload,
  inboundReceiveEmailAttachment,
} from "@/lib/protocol/inboundPayload";
import { recordOutcome, daysBetween } from "@/lib/strategy/store";
import { mandateEmailAttachment, proofsInboundAddress } from "@/lib/mandate/document";
import { maskPhone } from "@/lib/phone";
import { outreachSubjectForVertical } from "@/lib/outreachSubject";
import { pushToUser } from "@/lib/push";
import { absoluteLocaleUrl, localeForCountry } from "@/lib/localePath";
import { feePayAbsoluteUrl, feePayDashboardPath } from "@/lib/feePayPath";
import { withFooter } from "@/lib/letterFooter";
import { institutionPullFooterLine, institutionSalesEmail } from "@/lib/institutionPull";
import { notifyInstitutionOnOutboundSend } from "@/lib/institutionOutboundNotify";
import { publicSupportEmail } from "@/lib/contact";
import { buildOutreachProtocolFooter } from "@/lib/outreachSwitchingMeta";

export class CaseError extends Error {}

/** Days a customer has to dispute a success-fee charge (see Trust page). */
export const FEE_DISPUTE_WINDOW_DAYS = 14;

function marketForCase(vertical: string): string {
  return getRulePack(vertical)?.country ?? "IL";
}

function supportEmail(): string {
  return publicSupportEmail();
}

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "https://zakai-3uxj.vercel.app";
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
  /** Direct contact email for a counterparty not in providers.ts (e.g. late-payment's client). */
  counterpartyEmail?: string;
  vertical?: string;
  strategyVariant?: string;
  strategySeed?: number;
  autoApprove?: boolean;
}

/**
 * Collapse APPROVED → VERIFIED when the account already proved email control.
 * Visa rule: every consented case should be one tap from a machine Mandate send.
 */
export async function primeCaseForFastSend(
  userId: string,
  caseId: string,
): Promise<{ ownershipViaEmail: boolean }> {
  const ownershipViaEmail = await stampOwnershipFromVerifiedEmail(userId, caseId);
  if (ownershipViaEmail) {
    try {
      await createAuthorization(caseId);
    } catch {
      /* may already exist */
    }
  }
  await refreshVerifiedStatus(caseId);
  return { ownershipViaEmail };
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
  const created = await prisma.case.create({
    data: {
      userId: input.userId,
      vertical: input.vertical ?? "telecom",
      provider: input.provider,
      counterpartyEmail: input.counterpartyEmail ?? null,
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

  // Every auto-approved vertical (cancel, bank-fees, scan batch, …) enters the
  // fast Mandate path — one network of rails, not one-off UX per door.
  if (input.autoApprove) {
    await primeCaseForFastSend(input.userId, created.id);
    const refreshed = await prisma.case.findUnique({ where: { id: created.id } });
    if (refreshed) return refreshed;
  }
  return created;
}

async function ownedCase(caseId: string, userId: string) {
  const kase = await prisma.case.findUnique({ where: { id: caseId } });
  if (!kase || kase.userId !== userId) throw new CaseError("NOT_FOUND");
  return kase;
}

/**
 * Record the user's consent to the drafted request.
 *
 * Guarded, because it had no guard at all: it set the status unconditionally,
 * so approving an already-sent case walked it backwards to APPROVED, and
 * overwrote `approvedAt` with today. That timestamp is the record of when the
 * person consented to what was actually sent — the one fact a provider or a
 * regulator would ask about — and silently moving it is worse than losing it,
 * because the row still looks authoritative.
 *
 * Approving twice is allowed and does nothing the second time. Approving after
 * the case has moved on is refused: the message that went out cannot be
 * re-consented to after the fact, and editing the draft at that point would
 * leave the record disagreeing with the letter in the provider's inbox.
 */
export async function approveCase(
  caseId: string,
  userId: string,
  editedMessage?: string,
  approverIp?: string,
  counterpartyEmail?: string,
) {
  const kase = await ownedCase(caseId, userId);

  const outreach =
    counterpartyEmail?.trim() && /@/.test(counterpartyEmail)
      ? counterpartyEmail.trim().toLowerCase()
      : undefined;

  // VERIFIED: allow draft / outreach email tweaks before dispatch — not after SENT.
  if (kase.status === "VERIFIED") {
    if (!editedMessage && !outreach) throw new CaseError("ALREADY_SENT");
    return prisma.case.update({
      where: { id: kase.id },
      data: {
        ...(editedMessage ? { draftMessage: editedMessage } : {}),
        ...(outreach ? { counterpartyEmail: outreach } : {}),
      },
    });
  }

  if (kase.status !== "ANALYZED" && kase.status !== "APPROVED") {
    throw new CaseError("ALREADY_SENT");
  }

  return prisma.case.update({
    where: { id: kase.id },
    data: {
      status: "APPROVED",
      approvedAt: kase.approvedAt ?? new Date(),
      approvedIp: kase.approvedIp ?? approverIp ?? null,
      ...(editedMessage ? { draftMessage: editedMessage } : {}),
      ...(outreach ? { counterpartyEmail: outreach } : {}),
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
 * document without leaving their inbox. After send, the user is notified with
 * the proofs@ forward address so the closed-loop SavingsProof path is obvious.
 */
export async function sendOutreach(caseId: string, userId: string) {
  const kase = await ownedCase(caseId, userId);
  const auth = await prisma.authorization.findUnique({ where: { caseId } });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, country: true },
  });

  if (!kase.ownershipVerifiedAt) throw new CaseError("OWNERSHIP_REQUIRED");
  if (!auth || auth.status !== "ACTIVE") throw new CaseError("AUTHORIZATION_REQUIRED");

  const to = resolveCaseOutreachTo(kase);
  if (!to) {
    throw new CaseError("NEEDS_OUTREACH_EMAIL");
  }

  // Claim the send before making it, with a conditional update.
  //
  // The previous version read the status, checked it, then sent, then wrote —
  // so two requests arriving together both passed the check and both posted a
  // letter to the provider in the customer's name. A double-click is enough.
  //
  // This transitions only from a state that has not sent yet, and a zero row
  // count means somebody else already claimed it. The trade is deliberate: if
  // the send then fails we are left marked SENT with no letter, which the
  // Outbox shows and the user can retry. A duplicate letter cannot be unsent,
  // and it arrives at a provider under their name.
  const claimed = await prisma.case.updateMany({
    where: { id: caseId, status: { in: ["ANALYZED", "APPROVED", "VERIFIED"] } },
    data: { status: "SENT" },
  });
  if (claimed.count === 0) throw new CaseError("ALREADY_SENT");

  const appUrl = appBaseUrl();
  const provider = providerHebrewName(kase.provider);
  const mandateTok = await ensureMandateTokenForCase(caseId);
  // When signing keys are live, the pipe requires a machine Mandate on every SENT.
  if (!mandateTok) {
    try {
      loadSigningKeyFromEnv();
      throw new CaseError("MANDATE_REQUIRED");
    } catch (err) {
      if (err instanceof CaseError) throw err;
      if (!(err instanceof MandateKeyUnavailableError)) {
        throw new CaseError("MANDATE_REQUIRED");
      }
      // Keys unavailable — human Authorization still goes out (dev / pre-key envs).
    }
  }
  const mandateJti = mandateTok?.jti;
  const protocolFooter = buildOutreachProtocolFooter({
    appUrl,
    authCode: auth.code,
    mandateJti,
    vertical: kase.vertical,
    market: user?.country ?? "IL",
  });
  const footer = `

————————————————————————
מסמך הרשאה (ייפוי כוח) — שירות זכאי
מיופה כוח: זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם הלקוח/ה ${auth.principalName} בהרשאתו/ה.
קוד אימות ההרשאה: ${auth.code}
לאימות ההרשאה: ${appUrl}/verify?code=${auth.code}
מצורף: מסמך הרשאה מלא (HTML) + JSON inbound (zakai-inbound-receive).
גילוי: זכאי אינו הלקוח/ה. ניתן ליצור קשר עם הלקוח/ה ישירות.
${institutionPullFooterLine("he", appUrl)}
לאוטומציה: ${institutionSalesEmail()}${protocolFooter}`;

  const attachment = mandateEmailAttachment({
    code: auth.code,
    principalName: auth.principalName,
    principalContact: maskPhone(auth.principalPhone),
    provider: auth.provider,
    scope: auth.scope,
    issuedAt: auth.issuedAt,
    status: auth.status,
  });

  const loc = localeForCountry(user?.country);
  const footerLocale = loc === "he" || loc === "ar" ? "he" : "en";
  const messageBody = withFooter(kase.draftMessage, footerLocale);

  const inboundAtt = mandateTok
    ? inboundReceiveEmailAttachment(
        buildInboundReceivePayload({
          mandateJws: mandateTok.jws,
          mandateJti: mandateTok.jti,
          authorizationCode: auth.code,
          caseId,
          vertical: kase.vertical,
          strategyHint: kase.strategy,
          locale: loc === "he" ? "he-IL" : "en",
          market: user?.country ?? "IL",
        }),
      )
    : null;

  const email = await sendEmail({
    to,
    subject: outreachSubjectForVertical(kase.vertical, auth.principalName, auth.code),
    body: messageBody + footer,
    caseId,
    attachments: inboundAtt ? [attachment, inboundAtt] : [attachment],
  });

  if (email.status === "FAILED") {
    await prisma.case.update({ where: { id: caseId }, data: { status: "VERIFIED" } });
    throw new CaseError("OUTREACH_DELIVERY_FAILED");
  }

  if (email.status === "SENT") {
    void notifyInstitutionOnOutboundSend(auth.mandateAudience).catch(() => {});
  }

  // Status was already claimed above, before the letter went out.

  // Closed-loop: tell the user where to forward the provider reply.
  const proofsAddr = proofsInboundAddress();
  if (user?.email) {
    const dashUrl = absoluteLocaleUrl(
      appUrl,
      localeForCountry(user.country),
      "/dashboard",
    );
    await sendEmail({
      to: user.email,
      subject: `זכאי — נשלח ל-${provider} | מה הלאה`,
      body: `שלום ${user.name},

הסוכן שלח בשמך פנייה בכתב ל-${provider}, עם מסמך ההרשאה (ייפוי כוח) מצורף.

מה אפשר לעשות עכשיו:
• אם ענו — העבירו את המייל שלהם אל ${proofsAddr}
  (הסוכן יזהה סכום ויציע רישום חיסכון בלחיצה אחת בדשבורד).
• אם לא ענו תוך כמה ימים — הסוכן ישלח סיבוב 2 אוטומטית.
• לעצירה — בטלו את ההרשאה במסמך האימות.

דשבורד: ${dashUrl}

הכול בתוך זכאי. עמלה רק על חיסכון מתועד.

זכאי — הסוכן שלך.`,
      caseId,
    });

    await pushToUser(userId, {
      title: "זכאי — נשלח לספק",
      body: `פנייה ל-${provider} יצאה. העבירו תשובה ל-${proofsAddr}`,
      url: "/dashboard",
      tag: `sent-${caseId}`,
    }).catch(() => null);
  }

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
    const pack = getRulePack(kase.vertical);
    const rateBps = effectiveFeeRateBps(pack, planRateBps);
    const feeBasis = pack?.feeBasis ?? "monthly";
    const fee = computeCaseSuccessFee(kase.amountOriginal, newAmount, feeBasis, rateBps);
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
  const outcomeBasis = getRulePack(kase.vertical)?.feeBasis ?? "monthly";

  await recordOutcome({
    context: {
      market: marketForCase(kase.vertical),
      vertical: kase.vertical,
      counterparty: kase.provider,
    },
    variantId: kase.strategyVariant,
    paid: fee.savingMonthly > 0,
    recoveredMinor: documentedRecoveryMinor(fee.savingMonthly, outcomeBasis),
    days: daysBetween(kase.approvedAt ?? kase.createdAt, new Date()),
  });

  if (result.feeNet > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, country: true },
    });
    if (user) {
      const payUrl = feePayAbsoluteUrl(appBaseUrl(), user.country, caseId);
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
          payUrl,
        }),
        caseId,
      });
    }
  }

  if (fee.savingMonthly > 0) {
    const savingShekels = Math.round(fee.savingMonthly / 100);
    const profile = await prisma.user.findUnique({
      where: { id: userId },
      select: { country: true },
    });
    const dashPay = feePayDashboardPath(localeForCountry(profile?.country), caseId);
    await pushToUser(userId, {
      title: "זכאי — חיסכון מתועד",
      body:
        result.feeNet > 0
          ? `תועד חיסכון ₪${savingShekels}. שלם עמלה בלחיצה אחת בדשבורד.`
          : `תועד חיסכון של ₪${savingShekels}. שתף או המשך בדשבורד.`,
      url: result.feeNet > 0 ? dashPay : `/dashboard?saved=1&case=${caseId}`,
      tag: `saved-${caseId}`,
    }).catch(() => null);
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
  payUrl?: string;
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
${p.payUrl ? `\nלתשלום עמלת ההצלחה (חד-פעמי, מאובטח): ${p.payUrl}\n` : ""}
זכאי הוא שירות סוכן דיגיטלי אוטומטי הפועל מטעמך בהרשאתך. אין באמור ייעוץ משפטי, פיננסי או ביטוחי.

בברכה,
צוות זכאי`;
}
