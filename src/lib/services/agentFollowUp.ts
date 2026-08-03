import "server-only";
import { institutionPullFooterLine, institutionSalesEmail } from "@/lib/institutionPull";
import { buildOutreachProtocolFooter } from "@/lib/outreachSwitchingMeta";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/messaging";
import { buildFollowUpForVertical } from "@/lib/followUpRouter";
import type { ProviderReplyKind } from "@/lib/negotiation";
import { providerHebrewName } from "@/lib/providers";
import { resolveCaseOutreachTo } from "@/lib/caseOutreach";
import { agorotToShekels } from "@/lib/money";
import { pushToUser } from "@/lib/push";
import { mandateEmailAttachment, proofsInboundAddress } from "@/lib/mandate/document";
import { maskPhone } from "@/lib/phone";
import { ensureMandateTokenForCase } from "@/lib/services/authorization";
import {
  buildInboundReceivePayload,
  inboundReceiveEmailAttachment,
} from "@/lib/protocol/inboundPayload";
import { MAX_AGENT_ROUNDS } from "@/lib/services/loopLimits";

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
export { MAX_AGENT_ROUNDS };

export interface AutoFollowUpResult {
  caseId: string;
  sent: boolean;
  round?: number;
  reason?: string;
}

/** Batch count of agent auto-follow-up rounds (subject marker) for next-action ranking. */
export async function getAgentRoundMap(caseIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (caseIds.length === 0) return map;
  const outs = await prisma.outbox.groupBy({
    by: ["caseId"],
    where: {
      caseId: { in: caseIds },
      channel: "EMAIL",
      providerMessageId: { not: "inbound" },
      subject: { startsWith: AGENT_SUBJECT_PREFIX },
    },
    _count: { _all: true },
  });
  for (const o of outs) {
    if (o.caseId) map.set(o.caseId, o._count._all);
  }
  return map;
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
  return dispatchCaseFollowUp(caseId, {
    replyKind: "delay",
    notifyUser: true,
    autoSubjectPrefix: true,
  });
}

export interface DispatchFollowUpOpts {
  replyKind: ProviderReplyKind;
  /** If omitted, computed from prior agent rounds (+2). */
  round?: number;
  competitorName?: string;
  competitorPriceShekels?: number;
  /** Notify the consumer by email + push (default true for auto). */
  notifyUser?: boolean;
  /** Prefix subject with AGENT_SUBJECT_PREFIX for round counting. */
  autoSubjectPrefix?: boolean;
}

/**
 * Build + send a written follow-up with Mandate attached.
 * Used by the delay cron and by HITL "Send via Zakai" from the dashboard.
 */
export async function dispatchCaseFollowUp(
  caseId: string,
  opts: DispatchFollowUpOpts,
): Promise<AutoFollowUpResult & { body?: string; tip?: string; subject?: string }> {
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
  // Cap is on prior sends, not on the clamped round number — otherwise HITL
  // can re-send forever at round === MAX after Math.min in the API.
  if (prior >= MAX_AGENT_ROUNDS) {
    return { caseId, sent: false, reason: "MAX_ROUNDS", round: prior };
  }
  const round = Math.min(MAX_AGENT_ROUNDS, opts.round ?? prior + 2);
  if (round > MAX_AGENT_ROUNDS) {
    return { caseId, sent: false, reason: "MAX_ROUNDS", round };
  }

  const auth = kase.authorization;
  const provider = providerHebrewName(kase.provider);
  const follow = buildFollowUpForVertical(kase.vertical, {
    customerName: kase.user.name,
    providerLabel: provider,
    amountOriginalShekels: agorotToShekels(kase.amountOriginal),
    targetShekels: agorotToShekels(kase.targetAmount),
    plan: kase.planDescription || undefined,
    replyKind: opts.replyKind,
    round,
    competitorName: opts.competitorName,
    competitorPriceShekels: opts.competitorPriceShekels,
  });

  const usePrefix = opts.autoSubjectPrefix !== false;
  const subject = usePrefix
    ? `${AGENT_SUBJECT_PREFIX} ${round} — ${follow.subject}`
    : follow.subject;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const protocolFooter = buildOutreachProtocolFooter({
    appUrl,
    authCode: auth.code,
    mandateJti: auth.mandateJti,
    vertical: kase.vertical,
    market: "IL",
  });
  const footer = `

————————————————————————
מסמך הרשאה (ייפוי כוח) — שירות זכאי
מיופה כוח: זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם הלקוח/ה ${auth.principalName} בהרשאתו/ה.
קוד אימות ההרשאה: ${auth.code}
לאימות ההרשאה: ${appUrl}/verify?code=${auth.code}
מצורף: מסמך הרשאה מלא (HTML) + JSON inbound.
גילוי: זכאי אינו הלקוח/ה. ניתן ליצור קשר עם הלקוח/ה ישירות.
${institutionPullFooterLine("he", appUrl)}
לאוטומציה: ${institutionSalesEmail()}
זוהי פנייה חוזרת של הסוכן (סיבוב ${round}) — הלקוח/ה אישר/ה את השליחה.
${protocolFooter}`;

  const attachment = mandateEmailAttachment({
    code: auth.code,
    principalName: auth.principalName,
    principalContact: maskPhone(auth.principalPhone),
    provider: auth.provider,
    scope: auth.scope,
    issuedAt: auth.issuedAt,
    status: auth.status,
  });

  const mandateTok =
    auth.mandateJws && auth.mandateJti
      ? { jti: auth.mandateJti, jws: auth.mandateJws }
      : await ensureMandateTokenForCase(caseId);
  const inboundAtt = mandateTok
    ? inboundReceiveEmailAttachment(
        buildInboundReceivePayload({
          mandateJws: mandateTok.jws,
          mandateJti: mandateTok.jti,
          authorizationCode: auth.code,
          caseId,
          vertical: kase.vertical,
          strategyHint: kase.strategy,
          locale: "he-IL",
          market: "IL",
        }),
      )
    : null;

  const to = resolveCaseOutreachTo(kase);
  if (!to) {
    return { caseId, sent: false, reason: "NEEDS_OUTREACH_EMAIL", body: follow.body, tip: follow.tip, subject };
  }

  await sendEmail({
    to,
    subject,
    body: follow.body + footer,
    caseId,
    attachments: inboundAtt ? [attachment, inboundAtt] : [attachment],
  });

  await prisma.case.update({
    where: { id: caseId },
    data: { updatedAt: new Date() },
  });

  if (opts.notifyUser !== false && kase.user.email) {
    const proofsAddr = proofsInboundAddress();
    await sendEmail({
      to: kase.user.email,
      subject: `זכאי — הסוכן שלח פנייה חוזרת ל-${provider} (סיבוב ${round})`,
      body: `שלום ${kase.user.name},

הסוכן שלח בשמך פנייה חוזרת בכתב ל-${provider} (סיבוב ${round}), עם מסמך ההרשאה הפעיל מצורף.

מה אפשר לעשות עכשיו:
• אם ענו — העבירו את המייל שלהם אל ${proofsAddr} (או הזינו סכום חדש בדשבורד).
• אם רוצים לעצור — בטלו את ההרשאה במסמך האימות.

הכול בתוך זכאי. עמלה רק על חיסכון מתועד.

זכאי — הסוכן שלך.`,
      caseId,
    });

    await pushToUser(kase.user.id, {
      title: "זכאי — הסוכן פעל",
      body: `סיבוב ${round}: נשלחה פנייה ל-${provider}. פתחו את הדשבורד אם ענו.`,
      url: "/dashboard",
      tag: `followup-${caseId}-r${round}`,
    }).catch(() => null);
  }

  return {
    caseId,
    sent: true,
    round,
    body: follow.body,
    tip: follow.tip,
    subject,
  };
}
