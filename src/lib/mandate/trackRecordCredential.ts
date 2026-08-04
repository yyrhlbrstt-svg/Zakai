/**
 * A portable, signed statement of a user's own documented recovery history —
 * "I have N resolved cases and ₪X in verified monthly savings" — that they
 * can show a new counterparty (a bank weighing a new account, a landlord, an
 * employer) as a positive signal, the same way a credit reference works.
 *
 * Deliberately NOT a Mandate: it carries no scope, no audience, no authority
 * to act — it is a signed fact about the past, not a grant for the future.
 * Reusing `mandate.ts`'s claim vocabulary here would blur that line, so this
 * has its own `typ` and claim namespace precisely so a verifier can never
 * mistake it for authorisation to do anything. It reuses the same Ed25519
 * signing key (the same JWKS already published) because the signature's
 * trust anchor is genuinely the same one — only the semantics differ.
 *
 * Numbers come only from `SavingsProof` rows with `selfReported: false` —
 * the same split every other public-facing aggregate in this codebase uses
 * (see `impact.ts`, `companyScore.ts`): a self-report is somebody's word, a
 * verified proof has a provider reply behind it, and a credential someone
 * hands to a third party as evidence must not quietly include the former.
 */
import "server-only";
import { SignJWT, importJWK, compactVerify, type JWK } from "jose";
import { prisma } from "@/lib/prisma";
import { loadSigningKeyFromEnv, MandateKeyUnavailableError, type SigningKey } from "./mandate";

export const TRACK_RECORD_TYPE = "zakai-track-record+jwt";
export const TRACK_RECORD_CLAIM_NS = "ztr";
export const TRACK_RECORD_VERSION = 1;

/** Credentials describe the past; a year is long enough to still feel current. */
export const TRACK_RECORD_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface TrackRecordStats {
  resolvedCases: number;
  /** Sum of verified SavingsProof.savingMonthly, agorot. */
  documentedMonthlySavingAgorot: number;
  /** ISO date of the account's oldest case, or null if there are none yet. */
  activeSince: string | null;
}

const EMPTY_STATS: TrackRecordStats = {
  resolvedCases: 0,
  documentedMonthlySavingAgorot: 0,
  activeSince: null,
};

/** Real, DB-backed numbers only — never fabricated, never estimated. */
export async function loadTrackRecordStats(userId: string): Promise<TrackRecordStats> {
  try {
    const [proofAgg, proofCount, firstCase] = await Promise.all([
      prisma.savingsProof.aggregate({
        where: { selfReported: false, case: { userId } },
        _sum: { savingMonthly: true },
      }),
      prisma.savingsProof.count({ where: { selfReported: false, case: { userId } } }),
      prisma.case.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);
    return {
      resolvedCases: proofCount,
      documentedMonthlySavingAgorot: proofAgg._sum.savingMonthly ?? 0,
      activeSince: firstCase?.createdAt.toISOString() ?? null,
    };
  } catch {
    // A DB hiccup must fail the request, not hand back a credential with
    // fabricated zeros presented as real — see issueTrackRecordCredential.
    throw new TrackRecordUnavailableError("stats_unavailable");
  }
}

export class TrackRecordUnavailableError extends Error {
  constructor(readonly code: "stats_unavailable" | "no_history") {
    super(code);
    this.name = "TrackRecordUnavailableError";
  }
}

export interface TrackRecordClaims {
  v: number;
  iss: string;
  jti: string;
  iat: number;
  exp: number;
  stats: TrackRecordStats;
}

/**
 * Sign a credential for this user's real history. Refuses to issue one with
 * zero resolved cases — a credential asserting nothing is not evidence, and
 * handing it out invites exactly the "everyone has one" dilution that makes
 * a credential worthless as a signal.
 */
export async function issueTrackRecordCredential(
  userId: string,
  issuer: string,
  key: SigningKey = loadSigningKeyFromEnv(),
): Promise<{ token: string; stats: TrackRecordStats }> {
  const stats = await loadTrackRecordStats(userId);
  if (stats.resolvedCases === 0) {
    throw new TrackRecordUnavailableError("no_history");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const jti = `ztr_${userId}_${nowSec}`;
  const privateKey = await importJWK(key.privateJwk, "EdDSA");

  const token = await new SignJWT({
    [TRACK_RECORD_CLAIM_NS]: { v: TRACK_RECORD_VERSION, stats },
  })
    .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: TRACK_RECORD_TYPE })
    .setIssuer(issuer)
    .setJti(jti)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + TRACK_RECORD_TTL_SECONDS)
    .sign(privateKey);

  return { token, stats };
}

export class TrackRecordVerifyError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_SIGNATURE" | "WRONG_TYPE" | "EXPIRED" | "MALFORMED",
  ) {
    super(message);
    this.name = "TrackRecordVerifyError";
  }
}

/** Verify a credential someone presented to you, against the issuer's published JWKS. */
export async function verifyTrackRecordCredential(
  token: string,
  publicJwks: JWK[],
): Promise<TrackRecordClaims> {
  const [headerB64] = token.split(".");
  if (!headerB64) throw new TrackRecordVerifyError("malformed token", "MALFORMED");
  let typ: string | undefined;
  try {
    typ = (JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8")) as { typ?: string }).typ;
  } catch {
    throw new TrackRecordVerifyError("malformed header", "MALFORMED");
  }
  if (typ !== TRACK_RECORD_TYPE) {
    throw new TrackRecordVerifyError(`expected typ="${TRACK_RECORD_TYPE}", got "${typ}"`, "WRONG_TYPE");
  }

  let payload: Uint8Array | undefined;
  for (const jwk of publicJwks) {
    try {
      const key = await importJWK(jwk, "EdDSA");
      payload = (await compactVerify(token, key)).payload;
      break;
    } catch {
      continue;
    }
  }
  if (!payload) throw new TrackRecordVerifyError("no published key verifies this signature", "INVALID_SIGNATURE");

  const claims = JSON.parse(Buffer.from(payload).toString("utf8")) as {
    iss: string;
    jti: string;
    iat: number;
    exp: number;
    [TRACK_RECORD_CLAIM_NS]: { v: number; stats: TrackRecordStats };
  };
  if (claims.exp * 1000 < Date.now()) {
    throw new TrackRecordVerifyError("credential expired", "EXPIRED");
  }
  return {
    v: claims[TRACK_RECORD_CLAIM_NS].v,
    iss: claims.iss,
    jti: claims.jti,
    iat: claims.iat,
    exp: claims.exp,
    stats: claims[TRACK_RECORD_CLAIM_NS].stats,
  };
}

export { MandateKeyUnavailableError };
export const EMPTY_TRACK_RECORD_STATS = EMPTY_STATS;
