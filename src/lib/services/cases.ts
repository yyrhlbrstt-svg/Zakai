import "server-only";
import { prisma } from "@/lib/prisma";
import { shekelsToAgorot } from "@/lib/money";
import { computeCaseSuccessFee, documentedRecoveryMinor } from "@/lib/fee";
import { getRulePack, effectiveFeeRateBps } from "@/lib/verticals";
import { planConfig, canOpenCase, ACTIVE_CASE_STATUSES } from "@/lib/plans";
import { applyCredit, referralRewardForCount } from "@/lib/referral";
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
import { commitCaseLearningSignal, daysToSettle } from "@/lib/strategy/learningSignal";
import { mandateEmailAttachment, proofsInboundAddress } from "@/lib/mandate/document";
import { maskPhone } from "@/lib/phone";
import { outreachSubjectForVertical } from "@/lib/outreachSubject";
import { pushToUser } from "@/lib/push";
import { absoluteLocaleUrl, localeForCountry } from "@/lib/localePath";
import {
  FEE_DISPUTE_WINDOW_DAYS,
  feeConfirmAbsoluteUrl,
  feeConfirmDashboardPath,
  feeConfirmationBody,
} from "@/lib/feeConfirmNotify";
import { paymentsFullyLive } from "@/lib/deploy/releaseGate";
import { withFooter } from "@/lib/letterFooter";
import {
  institutionPipeMagnetLine,
  institutionPullFooterLine,
  institutionSalesEmail,
} from "@/lib/institutionPull";
import { notifyInstitutionOnOutboundSend } from "@/lib/institutionOutboundNotify";
import { buildOutreachProtocolFooter } from "@/lib/outreachSwitchingMeta";
import { mandateAttachClaimLine } from "@/lib/services/outreachAttachments";
import { notifyUserProviderOutreachDelivered } from "@/lib/services/outreachDeliveredNotify";

export class CaseError extends Error {}

export { FEE_DISPUTE_WINDOW_DAYS };

function marketForCase(vertical: string): string {
  return getRulePack(vertical)?.country ?? "IL";
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
  /** Model that wrote the draft, as "provider:model". */
  drafterId?: string;
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
      drafterId: input.drafterId ?? null,
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

  // Persist resolved inbox so later follow-ups / cron don't re-hit NEEDS_OUTREACH_EMAIL
  // after a registry match that was never written to Case.counterpartyEmail.
  if (to !== (kase.counterpartyEmail ?? "").toLowerCase()) {
    await prisma.case.update({
      where: { id: caseId },
      data: { counterpartyEmail: to },
    });
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
  // If we cannot issue one, unclaim SENT → VERIFIED so FREE maxActiveCases is not
  // frozen on a ghost send (same recovery path as OUTREACH_DELIVERY_FAILED).
  if (!mandateTok) {
    try {
      loadSigningKeyFromEnv();
      await prisma.case.update({ where: { id: caseId }, data: { status: "VERIFIED" } });
      throw new CaseError("MANDATE_REQUIRED");
    } catch (err) {
      if (err instanceof CaseError) throw err;
      if (!(err instanceof MandateKeyUnavailableError)) {
        await prisma.case.update({ where: { id: caseId }, data: { status: "VERIFIED" } });
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

  // Claim only what was attached — pre-key soft path may send HTML-only.
  const footer = `

————————————————————————
מסמך הרשאה (ייפוי כוח) — שירות זכאי
מיופה כוח: זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם הלקוח/ה ${auth.principalName} בהרשאתו/ה.
קוד אימות ההרשאה: ${auth.code}
לאימות ההרשאה: ${appUrl}/verify?code=${auth.code}
${mandateAttachClaimLine(Boolean(inboundAtt))}
גילוי: זכאי אינו הלקוח/ה. ניתן ליצור קשר עם הלקוח/ה ישירות.
${institutionPullFooterLine("he", appUrl)}
${institutionPipeMagnetLine(appUrl)}
לאוטומציה: ${institutionSalesEmail()}${protocolFooter}`;

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
  // Never claim "נשלח" when Outbox is only QUEUED — async drain upgrades later.
  const proofsAddr = proofsInboundAddress();
  const delivered = email.status === "SENT";
  if (user?.email) {
    if (delivered) {
      await notifyUserProviderOutreachDelivered(caseId, email.subject, {
        kind: "initial",
      });
    } else {
      const moneyUrl = absoluteLocaleUrl(
        appUrl,
        localeForCountry(user.country),
        `/money?case=${caseId}`,
      );
      await sendEmail({
        to: user.email,
        subject: `זכאי — הפנייה ל-${provider} בתור שליחה | מה הלאה`,
        body: `שלום ${user.name},

הפנייה ל-${provider} נשמרה בתור שליחה (עדיין לא יצאה מהמערכת). ברגע שתשלח — תוכלו להעביר תשובת ספק אל ${proofsAddr}.

הכסף שלי: ${moneyUrl}

זכאי — הסוכן שלך.`,
        caseId,
      });

      await pushToUser(userId, {
        title: "זכאי — פנייה בתור שליחה",
        body: `פנייה ל-${provider} ממתינה לשליחה. בדקו ב״הכסף שלי״.`,
        url: `/money?case=${caseId}`,
        tag: `sent-queued-${caseId}`,
      }).catch(() => null);
    }
  }

  return email;
}

export type RecordSavingOptions = {
  /** How the new amount was obtained — inbound email parse vs typed vs estimate shortcut. */
  source?: "manual" | "inbound" | "estimate";
  /**
   * True for guessed shortcuts (~20%/50%). Counts on the person's record but
   * must never mint a chargeable success fee (schema doctrine).
   */
  selfReported?: boolean;
};

export async function recordSaving(
  caseId: string,
  userId: string,
  newAmountShekels: number,
  options: RecordSavingOptions = {},
) {
  const kase = await ownedCase(caseId, userId);
  if (kase.status !== "SENT") throw new CaseError("NOT_SENT");

  const existing = await prisma.savingsProof.findUnique({ where: { caseId } });
  if (existing) throw new CaseError("ALREADY_SETTLED");

  const newAmount = shekelsToAgorot(newAmountShekels);
  const selfReported = options.selfReported === true;
  const source = options.source ?? (selfReported ? "estimate" : "manual");

  const result = await prisma.$transaction(async (tx) => {
    // Re-read auth inside the transaction so a concurrent revoke cannot race a fee.
    const auth = await tx.authorization.findUnique({
      where: { caseId },
      select: { status: true, mandateJti: true },
    });
    if (!auth || auth.status !== "ACTIVE") throw new CaseError("AUTH_REVOKED");

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

    // Self-reported / estimate shortcuts never produce a defendable success fee.
    // A chargeable settle without a machine Mandate jti must refuse — silently
    // WAIVING looks like "no fee due" and hides that authority was never bound.
    let billableAmount = selfReported ? 0 : fee.amount;
    if (billableAmount > 0 && !auth.mandateJti) {
      throw new CaseError("MANDATE_REQUIRED");
    }
    const credit = applyCredit(billableAmount, owner?.referralCreditAgorot ?? 0);

    await tx.savingsProof.create({
      data: {
        caseId,
        originalAmount: kase.amountOriginal,
        newAmount,
        savingMonthly: fee.savingMonthly,
        source,
        selfReported,
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
        mandateJti: auth.mandateJti ?? null,
      },
    });
    if (credit.applied > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { referralCreditAgorot: credit.remainingCredit },
      });
    }

    // Self-reported saves never trigger a referral reward — same discipline as
    // billableAmount above. A self-report is somebody's word, not a documented
    // outcome (see selfReportedSaving.ts), and a referral reward pays out real
    // credit to a THIRD PARTY (the referrer) against that unverified number.
    // Without this guard, a burner account could self-report a fake saving on
    // a case its own referrer opened it for and mint real, uncapped credit
    // toward the referrer's own future fees — exactly the class of number
    // this codebase already decided can't support a charge, just paid to a
    // different person.
    if (saved && !selfReported && owner?.referredById) {
      const already = await tx.referralReward.findUnique({
        where: { referredUserId: userId },
      });
      if (!already) {
        // Count this referrer's successful referrals so far (this one is the
        // count-th) so a milestone bonus can stack on top of the flat reward —
        // rewarding a 3rd/5th/10th referral more than the first makes sharing
        // repeatedly worth more than sharing once.
        const priorCount = await tx.referralReward.count({
          where: { referrerId: owner.referredById },
        });
        const amountAgorot = referralRewardForCount(priorCount + 1);
        await tx.referralReward.create({
          data: {
            referrerId: owner.referredById,
            referredUserId: userId,
            triggeringCaseId: caseId,
            amountAgorot,
          },
        });
        await tx.user.update({
          where: { id: owner.referredById },
          data: { referralCreditAgorot: { increment: amountAgorot } },
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

  // Learning signal: documented settle → StrategyOutcome (de-identified). Background, fail-open.
  await commitCaseLearningSignal({
    caseId,
    context: {
      market: marketForCase(kase.vertical),
      vertical: kase.vertical,
      counterparty: kase.provider,
    },
    variantId: kase.strategyVariant,
    drafterId: kase.drafterId,
    paid: fee.savingMonthly > 0,
    recoveredMinor: documentedRecoveryMinor(fee.savingMonthly, outcomeBasis),
    days: await daysToSettle(caseId, kase.approvedAt ?? kase.createdAt),
    selfReported,
  });

  if (result.feeNet > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, country: true },
    });
    if (user) {
      // Settle required ACTIVE Mandate + jti — still pass flags explicitly so
      // mock PSP cannot invent payFee=1 / "מאובטח" (same bar as cron fee nudges).
      const paymentsLive = paymentsFullyLive();
      const payUrl = feeConfirmAbsoluteUrl(appBaseUrl(), user.country, caseId, {
        mandateActive: true,
        paymentsLive,
      });
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
          paymentsLive,
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
    const paymentsLive = paymentsFullyLive();
    const dashPay = feeConfirmDashboardPath(localeForCountry(profile?.country), caseId, {
      mandateActive: true,
      paymentsLive,
    });
    await pushToUser(userId, {
      title: "זכאי — חיסכון מתועד",
      body:
        result.feeNet > 0
          ? paymentsLive
            ? `תועד חיסכון ₪${savingShekels}. שלם עמלה בלחיצה אחת ב״הכסף שלי״.`
            : `תועד חיסכון ₪${savingShekels}. המשיכו ב״הכסף שלי״ (גבייה חיה עדיין לא מוגדרת).`
          : `תועד חיסכון של ₪${savingShekels}. שתף או המשך ב״הכסף שלי״.`,
      url: result.feeNet > 0 ? dashPay : `/money?case=${caseId}`,
      tag: `saved-${caseId}`,
    }).catch(() => null);
  }

  return result;
}
