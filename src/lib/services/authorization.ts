import "server-only";
import { randomUUID } from "crypto";
import type { Authorization } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAuthorizationCode } from "@/lib/codes";
import { maskPhone } from "@/lib/phone";
import {
  issueMandate,
  loadSigningKeyFromEnv,
  MandateKeyUnavailableError,
} from "@/lib/mandate/mandate";
import { resolveMandateAudience } from "@/lib/institutionAudience";

/** Scope text stored on the authorization (the mandate the provider can read). */
const SCOPE =
  "בדיקת החיוב החודשי מול הספק והפחתתו או התאמת המסלול, וניהול ההתכתבות הדרושה לכך בלבד. אינו כולל עסקאות חדשות, שינוי אמצעי תשלום, או מסירת מידע רגיש מעבר לנדרש לזיהוי.";

/** Machine scopes granted for a standard telecom / bill case. */
const CASE_MANDATE_SCOPES = [
  "read:bills",
  "request:records",
  "negotiate:tariff",
  "dispute:charge",
  "claim:submit",
  "settle:receive",
] as const;

/** Human Authorization row plus optional machine-verifiable Mandate fields. */
export type AuthorizationWithMandate = Authorization & {
  mandateJti?: string;
  mandateToken?: string;
};

/**
 * Generate the power-of-attorney-style authorization document for a case.
 * Idempotent: if one already exists for the case, it is returned as-is.
 * Also attempts to issue a machine-verifiable Mandate (Ed25519 JWS) bound to
 * the same provider audience. If signing keys are not configured, the human
 * authorization still succeeds — Mandate is additive, not a hard dependency.
 */
export async function createAuthorization(caseId: string): Promise<AuthorizationWithMandate> {
  const existing = await prisma.authorization.findUnique({ where: { caseId } });
  if (existing?.status === "ACTIVE") return existing;
  if (existing?.status === "REVOKED") {
    return reissueAuthorization(caseId, existing);
  }

  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { user: true },
  });
  if (!kase) throw new Error("case not found");

  const mandateAudience = resolveMandateAudience(kase.provider);

  let doc: Authorization | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAuthorizationCode();
    const clash = await prisma.authorization.findUnique({ where: { code } });
    if (clash) continue;
    doc = await prisma.authorization.create({
      data: {
        caseId,
        code,
        principalName: kase.user.name,
        principalPhone: kase.user.phone,
        principalEmail: kase.user.email,
        provider: kase.provider,
        scope: SCOPE,
        mandateAudience,
      },
    });
    break;
  }
  if (!doc) throw new Error("could not allocate a unique authorization code");

  const mandate = await tryIssueCaseMandate({
    caseId,
    userId: kase.userId,
    name: kase.user.name,
    email: kase.user.email,
    phone: kase.user.phone,
    provider: kase.provider,
    country: kase.user.country || "IL",
    authCode: doc.code,
    mandateAudience,
  });

  return { ...doc, ...mandate };
}

async function reissueAuthorization(
  caseId: string,
  prior: Authorization,
): Promise<AuthorizationWithMandate> {
  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { user: true },
  });
  if (!kase) throw new Error("case not found");

  const mandateAudience = resolveMandateAudience(kase.provider);
  let doc: Authorization | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAuthorizationCode();
    const clash = await prisma.authorization.findUnique({ where: { code } });
    if (clash) continue;
    doc = await prisma.authorization.update({
      where: { id: prior.id },
      data: {
        status: "ACTIVE",
        revokedAt: null,
        code,
        principalName: kase.user.name,
        principalPhone: kase.user.phone,
        principalEmail: kase.user.email,
        provider: kase.provider,
        scope: SCOPE,
        mandateAudience,
        issuedAt: new Date(),
      },
    });
    break;
  }
  if (!doc) throw new Error("could not allocate a unique authorization code");

  const mandate = await tryIssueCaseMandate({
    caseId,
    userId: kase.userId,
    name: kase.user.name,
    email: kase.user.email,
    phone: kase.user.phone,
    provider: kase.provider,
    country: kase.user.country || "IL",
    authCode: doc.code,
    mandateAudience,
  });

  return { ...doc, ...mandate };
}

async function tryIssueCaseMandate(input: {
  caseId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  provider: string;
  country: string;
  authCode: string;
  mandateAudience: string;
}): Promise<{ mandateJti?: string; mandateToken?: string }> {
  try {
    const key = loadSigningKeyFromEnv();
    const jti = randomUUID();
    const issuer =
      process.env.MANDATE_ISSUER ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://zakai-3uxj.vercel.app";

    const token = await issueMandate(
      {
        jti,
        issuer,
        audience: input.mandateAudience,
        subject: input.userId,
        principal: {
          name: input.name,
          reference: input.authCode,
          contactMasked: maskPhone(input.phone),
        },
        scopes: [...CASE_MANDATE_SCOPES],
        market: input.country.toUpperCase(),
        statement:
          `The principal authorises Zakai to correspond with ${input.provider} ` +
          `regarding billing review, tariff negotiation, dispute of charges, ` +
          `and receipt of refunds owed — and not to move funds outward.`,
      },
      key,
    );

    return { mandateJti: jti, mandateToken: token };
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) return {};
    console.error("mandate_issue_failed", err);
    return {};
  }
}

export async function revokeAuthorization(caseId: string, mandateJti?: string) {
  const updated = await prisma.authorization.update({
    where: { caseId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });

  if (mandateJti) {
    try {
      await prisma.mandateRevocation.upsert({
        where: { jti: mandateJti },
        create: {
          jti: mandateJti,
          reason: "authorization_revoked",
          internalNote: caseId,
        },
        update: {},
      });
    } catch {
      // Table may be missing in some environments; human revoke still stands.
    }
  }

  return updated;
}

/** Public lookup for the provider-facing verification page. Masks PII. */
export async function getPublicAuthorization(code: string) {
  const auth = await prisma.authorization.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!auth) return null;

  const mandateAudience = auth.mandateAudience ?? resolveMandateAudience(auth.provider);
  let institutionVerifierLeader = false;
  try {
    const row = await prisma.referenceVerifier.findUnique({
      where: { institutionId: mandateAudience },
      select: { institutionId: true },
    });
    institutionVerifierLeader = !!row;
  } catch {
    institutionVerifierLeader = false;
  }

  return {
    code: auth.code,
    status: auth.status,
    principalName: auth.principalName,
    principalPhoneMasked: maskPhone(auth.principalPhone),
    provider: auth.provider,
    mandateAudience,
    institutionVerifierLeader,
    scope: auth.scope,
    issuedAt: auth.issuedAt,
    revokedAt: auth.revokedAt,
  };
}
