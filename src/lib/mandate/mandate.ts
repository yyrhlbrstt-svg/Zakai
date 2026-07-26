/**
 * The Zakai Mandate — a signed, scoped, audience-bound, revocable statement
 * that a named person has authorised an agent to do specific things on their
 * behalf.
 *
 * WHAT THIS REPLACES
 *
 * `services/authorization.ts` already issues a power-of-attorney document with
 * a public verification code, which was the right instinct. But it is verified
 * by a human reading a web page, it is free text, it is one per case, and it
 * is not signed. An institution cannot build anything on it.
 *
 * This is the same idea made machine-consumable:
 *
 *   - **Signed** (EdDSA / Ed25519, compact JWS) and verifiable against a
 *     published JWKS. A bank checks a mandate **without calling Zakai**. That
 *     matters more than it sounds: an integration that requires a live call to
 *     a startup's API is an availability dependency their risk team will
 *     reject. One that verifies offline against a public key is not.
 *   - **Scoped** to the enumerated capabilities in `scopes.ts`, so what the
 *     consumer agreed to and what the institution enforces are the same
 *     vocabulary.
 *   - **Audience-bound**: a mandate presented to one institution cannot be
 *     replayed at another. Without `aud`, a leaked mandate is a skeleton key.
 *   - **Short-lived plus revocable.** A signature cannot be withdrawn once
 *     issued, so the design does not pretend otherwise: mandates expire
 *     quickly and carry a `jti` that the status endpoint can mark revoked.
 *     Institutions get correctness from the signature and recency from the
 *     status check — the same split OCSP and certificate expiry use, for the
 *     same reason.
 *   - **Minimal**: it carries the identity claims needed to act and nothing
 *     else. A mandate is presented to counterparties, so every extra field is
 *     a disclosure to a third party the consumer did not ask for.
 *
 * Deliberately *not* here: any capability to move the principal's money
 * outward. See `FORBIDDEN_SCOPES`.
 */

import { CompactSign, compactVerify, exportJWK, importJWK, type JWK } from "jose";
import { validateScopes } from "./scopes";

export const MANDATE_TYPE = "zakai-mandate+jws";
export const MANDATE_VERSION = 1;

/** Default lifetime. Short by design; renewal is cheap, a stale mandate is not. */
export const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

export class MandateError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_SCOPES"
      | "INVALID_SIGNATURE"
      | "EXPIRED"
      | "NOT_YET_VALID"
      | "AUDIENCE_MISMATCH"
      | "MALFORMED"
      | "UNSUPPORTED_VERSION",
  ) {
    super(message);
    this.name = "MandateError";
  }
}

/** The claims inside a mandate. Kept small: this is shown to counterparties. */
export interface MandateClaims {
  v: number;
  /** Mandate id — what a revocation list and an audit trail key on. */
  jti: string;
  /** Issuer: the Zakai deployment that signed it. */
  iss: string;
  /** The institution this mandate may be presented to. */
  aud: string;
  /** Subject: the principal's stable id in Zakai. */
  sub: string;
  /** The principal, as the institution needs to identify them on their side. */
  principal: {
    name: string;
    /** National/customer identifier, when the institution requires one. */
    reference?: string;
    /** Masked contact, for a human to confirm against their record. */
    contactMasked?: string;
  };
  scopes: string[];
  /** Jurisdiction the mandate is exercised under (ISO 3166-1 alpha-2). */
  market: string;
  iat: number;
  nbf: number;
  exp: number;
  /** Human-readable statement of authority, in the institution's language. */
  statement: string;
}

export interface IssueMandateInput {
  jti: string;
  issuer: string;
  audience: string;
  subject: string;
  principal: MandateClaims["principal"];
  scopes: string[];
  market: string;
  statement: string;
  ttlSeconds?: number;
  /** Injectable for deterministic tests. */
  now?: Date;
}

export interface SigningKey {
  kid: string;
  privateJwk: JWK;
}

/**
 * Issue a mandate. Throws rather than issuing something an institution would
 * have to reject — an invalid mandate that reaches a counterparty costs more
 * trust than a failed request costs convenience.
 */
export async function issueMandate(input: IssueMandateInput, key: SigningKey): Promise<string> {
  const problems = validateScopes(input.scopes);
  if (problems.length) throw new MandateError(problems.join("; "), "INVALID_SCOPES");
  if (!input.audience.trim()) throw new MandateError("audience is required", "MALFORMED");
  if (!input.jti.trim()) throw new MandateError("jti is required", "MALFORMED");

  const nowSec = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  const claims: MandateClaims = {
    v: MANDATE_VERSION,
    jti: input.jti,
    iss: input.issuer,
    aud: input.audience,
    sub: input.subject,
    principal: input.principal,
    scopes: [...input.scopes],
    market: input.market.toUpperCase(),
    iat: nowSec,
    nbf: nowSec,
    exp: nowSec + (input.ttlSeconds ?? DEFAULT_TTL_SECONDS),
    statement: input.statement,
  };

  const privateKey = await importJWK(key.privateJwk, "EdDSA");
  return new CompactSign(new TextEncoder().encode(JSON.stringify(claims)))
    .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: MANDATE_TYPE })
    .sign(privateKey);
}

export interface VerifyOptions {
  /** The verifying institution's own id. A mismatch is a replay attempt. */
  audience: string;
  /** Public keys, normally fetched once from the issuer's JWKS and cached. */
  publicJwks: JWK[];
  /** Clock skew tolerance, seconds. */
  toleranceSeconds?: number;
  now?: Date;
}

/**
 * Verify a mandate. This is the function an institution runs — the reference
 * implementation of the check, deliberately written so it can be reimplemented
 * in any language from the JWS alone.
 */
export async function verifyMandate(
  token: string,
  options: VerifyOptions,
): Promise<MandateClaims> {
  let payload: Uint8Array | undefined;
  let kid: string | undefined;

  for (const jwk of options.publicJwks) {
    try {
      const key = await importJWK(jwk, "EdDSA");
      const result = await compactVerify(token, key);
      payload = result.payload;
      kid = result.protectedHeader.kid;
      if (result.protectedHeader.typ !== MANDATE_TYPE) {
        throw new MandateError(`unexpected typ "${result.protectedHeader.typ}"`, "MALFORMED");
      }
      break;
    } catch (err) {
      if (err instanceof MandateError) throw err;
      // Wrong key for this token; try the next one.
    }
  }
  if (!payload) throw new MandateError("no configured key verifies this mandate", "INVALID_SIGNATURE");

  let claims: MandateClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(payload)) as MandateClaims;
  } catch {
    throw new MandateError("payload is not valid JSON", "MALFORMED");
  }

  if (claims.v !== MANDATE_VERSION) {
    throw new MandateError(`unsupported mandate version ${claims.v}`, "UNSUPPORTED_VERSION");
  }
  if (!Array.isArray(claims.scopes) || !claims.jti || !claims.sub) {
    throw new MandateError("mandate is missing required claims", "MALFORMED");
  }
  if (claims.aud !== options.audience) {
    throw new MandateError(
      `mandate was issued for "${claims.aud}", presented to "${options.audience}"`,
      "AUDIENCE_MISMATCH",
    );
  }

  const nowSec = Math.floor((options.now?.getTime() ?? Date.now()) / 1000);
  const slack = options.toleranceSeconds ?? 60;
  if (nowSec + slack < claims.nbf) throw new MandateError("mandate is not yet valid", "NOT_YET_VALID");
  if (nowSec - slack >= claims.exp) throw new MandateError("mandate has expired", "EXPIRED");

  // The scope set is re-validated on the verifying side. A forbidden scope
  // could only appear here through an issuer bug or a compromised key, and in
  // either case the counterparty must not act on it.
  const problems = validateScopes(claims.scopes);
  if (problems.length) throw new MandateError(problems.join("; "), "INVALID_SCOPES");

  void kid;
  return claims;
}

/** Does this mandate authorise this specific act? */
export function mandateAllows(claims: MandateClaims, scope: string): boolean {
  return claims.scopes.includes(scope);
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/** The public half, in the shape a JWKS endpoint serves. */
export async function publicJwkFor(key: SigningKey): Promise<JWK> {
  const priv = await importJWK(key.privateJwk, "EdDSA");
  const jwk = await exportJWK(priv);
  delete jwk.d;
  return { ...jwk, kid: key.kid, alg: "EdDSA", use: "sig" };
}

export class MandateKeyUnavailableError extends Error {
  constructor() {
    super("MANDATE_KEY_UNAVAILABLE");
    this.name = "MandateKeyUnavailableError";
  }
}

/**
 * Load the signing key from the environment.
 *
 * Throws when unset rather than generating an ephemeral key. A silently
 * self-signed mandate would verify locally, pass tests, and then fail at every
 * institution that had cached the real JWKS — the worst kind of failure,
 * because it looks like success right up until a customer is relying on it.
 * The same rule the AI layer already follows: never fabricate.
 */
export function loadSigningKeyFromEnv(
  env: Record<string, string | undefined> = process.env,
): SigningKey {
  const raw = env.MANDATE_SIGNING_JWK;
  const kid = env.MANDATE_SIGNING_KID;
  if (!raw || !kid) throw new MandateKeyUnavailableError();
  let privateJwk: JWK;
  try {
    privateJwk = JSON.parse(raw) as JWK;
  } catch {
    throw new MandateKeyUnavailableError();
  }
  if (privateJwk.kty !== "OKP" || !privateJwk.d) throw new MandateKeyUnavailableError();
  return { kid, privateJwk };
}
