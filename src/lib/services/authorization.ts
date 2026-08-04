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
import {
  allocateStatusIndex,
  publishRevocation,
  statusIndexForJti,
  statusListUriForIssuer,
} from "@/lib/mandate/statusIndex";

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
  mandateJti?: string | null;
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

  if (mandate.mandateJti) {
    doc = await prisma.authorization.update({
      where: { caseId },
      data: {
        mandateJti: mandate.mandateJti,
        ...(mandate.mandateToken ? { mandateJws: mandate.mandateToken } : {}),
        ...(typeof mandate.mandateStatusIndex === "number"
          ? { mandateStatusIndex: mandate.mandateStatusIndex }
          : {}),
      },
    });
  }

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

  // Prior machine Mandate must appear revoked before a replacement is minted —
  // otherwise the old JWS stays offline-valid while product auth is ACTIVE again.
  if (prior.mandateJti) {
    try {
      await prisma.$transaction((tx) =>
        publishRevocation(tx, {
          jti: prior.mandateJti!,
          reason: "reissue",
          statusIndex: prior.mandateStatusIndex ?? undefined,
        }),
      );
    } catch {
      /* status store down — still clear fields below so we do not re-attach it */
    }
  }

  const mandateAudience = resolveMandateAudience(kase.provider);
  let doc: Authorization | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateAuthorizationCode();
    const clash = await prisma.authorization.findUnique({ where: { code } });
    if (clash) continue;
    // Clear Mandate fields on the ACTIVE flip so a failed mint cannot leave
    // ACTIVE authority paired with a revoked (or missing) JWS.
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
        mandateJti: null,
        mandateJws: null,
        mandateStatusIndex: null,
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

  if (mandate.mandateJti) {
    doc = await prisma.authorization.update({
      where: { caseId },
      data: {
        mandateJti: mandate.mandateJti,
        ...(mandate.mandateToken ? { mandateJws: mandate.mandateToken } : {}),
        ...(typeof mandate.mandateStatusIndex === "number"
          ? { mandateStatusIndex: mandate.mandateStatusIndex }
          : {}),
      },
    });
    // SAVED + PENDING fee still points at the revoked prior jti after #88's
    // exact-match checkout gate. Re-bind to the live Mandate so prove→fee→share
    // can finish — never mint a fee here, only retarget the existing PENDING row.
    await prisma.fee.updateMany({
      where: { caseId, status: "PENDING" },
      data: { mandateJti: mandate.mandateJti },
    });
  }

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
  /**
   * Heal a missing JWS for an existing jti: resign with the same jti and the
   * issue-time status bit. Never allocate a new UUID / bit — that orphans Fee
   * binds and leaves any prior circulating token's idx forever unset on revoke.
   */
  reuse?: { jti: string; statusIndex?: number | null };
}): Promise<{ mandateJti?: string; mandateToken?: string; mandateStatusIndex?: number }> {
  try {
    const key = loadSigningKeyFromEnv();
    const jti = input.reuse?.jti ?? randomUUID();
    const issuer =
      process.env.MANDATE_ISSUER ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://zakai-3uxj.vercel.app";

    let statusIndex: number;
    if (input.reuse) {
      const fromAuth =
        typeof input.reuse.statusIndex === "number" &&
        Number.isInteger(input.reuse.statusIndex) &&
        input.reuse.statusIndex >= 0
          ? input.reuse.statusIndex
          : undefined;
      const resolved = fromAuth ?? (await statusIndexForJti(prisma, jti));
      if (typeof resolved !== "number") {
        // Fail closed: inventing a bit for a jti that already left the building
        // would make revoke flip the wrong index.
        console.error("mandate_jws_heal_missing_status_index", { jti, caseId: input.caseId });
        return {};
      }
      statusIndex = resolved;
    } else {
      // Fresh mint — allocate the status-list bit before signing so
      // zkm.status.idx is stable for the life of the token.
      statusIndex = await allocateStatusIndex(prisma, jti);
    }

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
        status: {
          idx: statusIndex,
          uri: statusListUriForIssuer(issuer),
        },
      },
      key,
    );

    return { mandateJti: jti, mandateToken: token, mandateStatusIndex: statusIndex };
  } catch (err) {
    if (err instanceof MandateKeyUnavailableError) return {};
    console.error("mandate_issue_failed", err);
    return {};
  }
}

/** Issue machine mandate if missing; persists jti (+ JWS) on the Authorization row. */
export async function ensureMandateJtiForCase(caseId: string): Promise<string | undefined> {
  const full = await ensureMandateTokenForCase(caseId);
  return full?.jti;
}

/** Ensure jti + compact JWS exist for structured inbound attachments. */
export async function ensureMandateTokenForCase(
  caseId: string,
): Promise<{ jti: string; jws: string } | undefined> {
  const auth = await prisma.authorization.findUnique({ where: { caseId } });
  if (!auth || auth.status !== "ACTIVE") return undefined;
  if (auth.mandateJti && auth.mandateJws) {
    return { jti: auth.mandateJti, jws: auth.mandateJws };
  }

  const kase = await prisma.case.findUnique({
    where: { id: caseId },
    include: { user: true },
  });
  if (!kase) return undefined;

  // jti without jws → resign the same credential. Fresh mint only when jti is absent.
  const mandate = await tryIssueCaseMandate({
    caseId,
    userId: kase.userId,
    name: kase.user.name,
    email: kase.user.email,
    phone: kase.user.phone,
    provider: kase.provider,
    country: kase.user.country || "IL",
    authCode: auth.code,
    mandateAudience: auth.mandateAudience ?? resolveMandateAudience(kase.provider),
    reuse: auth.mandateJti
      ? { jti: auth.mandateJti, statusIndex: auth.mandateStatusIndex }
      : undefined,
  });
  if (!mandate.mandateJti || !mandate.mandateToken) return undefined;

  await prisma.authorization.update({
    where: { caseId },
    data: {
      mandateJti: mandate.mandateJti,
      mandateJws: mandate.mandateToken,
      ...(typeof mandate.mandateStatusIndex === "number"
        ? { mandateStatusIndex: mandate.mandateStatusIndex }
        : {}),
    },
  });
  return { jti: mandate.mandateJti, jws: mandate.mandateToken };
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
