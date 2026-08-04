import "server-only";
import { prisma } from "@/lib/prisma";
import { maskPhone } from "@/lib/phone";
import { mandateEmailAttachment } from "@/lib/mandate/document";
import {
  loadSigningKeyFromEnv,
  MandateKeyUnavailableError,
} from "@/lib/mandate/mandate";
import { ensureMandateTokenForCase } from "@/lib/services/authorization";
import {
  buildInboundReceivePayload,
  inboundReceiveEmailAttachment,
} from "@/lib/protocol/inboundPayload";
import { localeForCountry } from "@/lib/localePath";
import { AGENT_SUBJECT_PREFIX } from "@/lib/services/loopLimits";

export type OutreachAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

/**
 * Provider-bound outreach (initial send or agent follow-up) must carry the
 * Mandate HTML + inbound JSON. Outbox rows do not store attachments — when
 * OUTBOX_ASYNC drains later, regenerate from caseId instead of sending body-only.
 */

/** Subjects that mean "this letter goes to the provider with Mandate docs". */
export function shouldAttachMandateDocs(subject: string | null | undefined): boolean {
  if (!subject) return false;
  if (subject.startsWith(AGENT_SUBJECT_PREFIX)) return true;
  // Initial outreach subjects always embed the authorization code.
  return /הרשאה\s+ZK-[A-Z0-9]/i.test(subject);
}

export async function rebuildMandateAttachmentsForCase(
  caseId: string,
): Promise<OutreachAttachment[]> {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      authorization: true,
      user: { select: { country: true } },
    },
  });
  if (!kase?.authorization || kase.authorization.status !== "ACTIVE") return [];

  const auth = kase.authorization;
  const attachment = mandateEmailAttachment({
    code: auth.code,
    principalName: auth.principalName,
    principalContact: maskPhone(auth.principalPhone),
    provider: auth.provider,
    scope: auth.scope,
    issuedAt: auth.issuedAt,
    status: auth.status,
  });

  const mandateTok = await ensureMandateTokenForCase(caseId);
  if (!mandateTok) {
    try {
      loadSigningKeyFromEnv();
      // Signing keys are live but no machine Mandate — fail closed. Returning
      // HTML-only would let the async Outbox worker mark the letter "sent with
      // Mandate" without a verifiable JWS / inbound JSON.
      return [];
    } catch (err) {
      // Pre-key / local envs: human Authorization HTML still goes out (same
      // soft path as sync send when MandateKeyUnavailableError).
      if (err instanceof MandateKeyUnavailableError) return [attachment];
      return [];
    }
  }

  const loc = localeForCountry(kase.user?.country);
  const inboundAtt = inboundReceiveEmailAttachment(
    buildInboundReceivePayload({
      mandateJws: mandateTok.jws,
      mandateJti: mandateTok.jti,
      authorizationCode: auth.code,
      caseId,
      vertical: kase.vertical,
      strategyHint: kase.strategy,
      locale: loc === "he" ? "he-IL" : "en",
      market: kase.user?.country ?? "IL",
    }),
  );
  return [attachment, inboundAtt];
}
