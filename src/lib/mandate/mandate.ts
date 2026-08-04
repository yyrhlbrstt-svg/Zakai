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

import { SignJWT, compactVerify, exportJWK, importJWK, type JWK } from "jose";
import { validateScopes } from "./scopes";

/**
 * A mandate is a plain JWT.
 *
 * It was not, and that was the single biggest barrier to anyone outside this
 * codebase adopting it. Signed as a generic JWS with a proprietary `typ`, an
 * institution had to reach for a low-level JOSE library, parse the payload
 * itself, and hand-check audience and expiry — none of which their existing
 * JWT tooling would do for them, and all of which are exactly the checks that
 * get skipped or written wrong.
 *
 * As a JWT it verifies in three lines in every language that has a JWT library,
 * which is all of them; expiry, audience and issuer validation come for free
 * and correct; and a security team can audit it against a standard they already
 * know instead of a spec we wrote.
 *
 * A standard that needs our SDK is a product. A standard anyone's existing
 * library verifies is a protocol. Only the second one becomes infrastructure.
 */
export const MANDATE_TYPE = "JWT";
/** The pre-JWT envelope. Still accepted on verify so nothing already issued breaks. */
export const LEGACY_MANDATE_TYPE = "zakai-mandate+jws";

/**
 * Namespace for the claims JWT does not define. Everything that *is* a
 * registered claim — iss, aud, sub, jti, iat, nbf, exp — stays registered, so
 * standard validators enforce it rather than trusting us to.
 */
export const MANDATE_CLAIM_NS = "zkm";
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
  /**
   * Present only when this mandate was issued for a delegated third-party
   * agent rather than for Zakai's own verified user. Structured and inside the
   * signed token — not a sentence appended to `statement` — so an institution
   * can branch on it in code rather than parsing prose, and so it survives
   * translation of the statement into another language.
   */
  onBehalfOf?: {
    agent: string;
    name: string;
    note: string;
  };
  /**
   * Offline revocation pointer (IETF Token Status List style under `zkm`).
   * Institutions fetch `uri`, verify the signed bitstring, and read bit `idx`.
   */
  status?: {
    idx: number;
    uri: string;
  };
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
  /** See `MandateClaims.onBehalfOf`. Omit for a first-party mandate. */
  onBehalfOf?: MandateClaims["onBehalfOf"];
  /**
   * Status-list bit allocated at issue. Required for offline revoke; omit only
   * in unit tests that exercise legacy tokens without the claim.
   */
  status?: MandateClaims["status"];
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
  if (input.status) {
    if (!Number.isInteger(input.status.idx) || input.status.idx < 0) {
      throw new MandateError("status.idx must be a non-negative integer", "MALFORMED");
    }
    if (!input.status.uri.trim()) {
      throw new MandateError("status.uri is required when status is set", "MALFORMED");
    }
  }

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
    onBehalfOf: input.onBehalfOf,
    status: input.status
      ? { idx: input.status.idx, uri: input.status.uri.trim() }
      : undefined,
  };

  const privateKey = await importJWK(key.privateJwk, "EdDSA");
  return new SignJWT({
    // `scope` is the OAuth 2.0 spelling — space-delimited — so authorisation
    // servers and API gateways that already speak OAuth read the grant without
    // being taught anything about Zakai.
    scope: claims.scopes.join(" "),
    [MANDATE_CLAIM_NS]: {
      v: claims.v,
      principal: claims.principal,
      market: claims.market,
      statement: claims.statement,
      ...(claims.onBehalfOf ? { onBehalfOf: claims.onBehalfOf } : {}),
      ...(claims.status ? { status: claims.status } : {}),
    },
  })
    .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: MANDATE_TYPE })
    .setIssuer(claims.iss)
    .setAudience(claims.aud)
    .setSubject(claims.sub)
    .setJti(claims.jti)
    .setIssuedAt(claims.iat)
    .setNotBefore(claims.nbf)
    .setExpirationTime(claims.exp)
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
  let typ: string | undefined;

  for (const jwk of options.publicJwks) {
    try {
      const key = await importJWK(jwk, "EdDSA");
      const result = await compactVerify(token, key);
      payload = result.payload;
      typ = result.protectedHeader.typ;
      break;
    } catch (err) {
      if (err instanceof MandateError) throw err;
      // Wrong key for this token; try the next one.
    }
  }
  if (!payload) throw new MandateError("no configured key verifies this mandate", "INVALID_SIGNATURE");
  if (typ !== MANDATE_TYPE && typ !== LEGACY_MANDATE_TYPE) {
    throw new MandateError(`unexpected typ "${typ}"`, "MALFORMED");
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
  } catch {
    throw new MandateError("payload is not valid JSON", "MALFORMED");
  }

  // Two shapes, one internal representation. Anything issued before the move to
  // JWT still verifies — a protocol that invalidates outstanding credentials on
  // an internal refactor is not one anybody will build against.
  const claims: MandateClaims = normaliseClaims(raw);
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

  return claims;
}

/** Does this mandate authorise this specific act? */

/**
 * Read either envelope into the same claims object.
 *
 * The JWT form keeps registered claims registered and puts everything else
 * under `zkm`; the legacy form was one flat object. Supporting both is a few
 * lines here and saves every holder of an outstanding mandate from a forced
 * re-issue.
 */
function normaliseClaims(raw: Record<string, unknown>): MandateClaims {
  const ns = (raw[MANDATE_CLAIM_NS] ?? {}) as Record<string, unknown>;
  const isJwtShape = typeof raw.scope === "string" || MANDATE_CLAIM_NS in raw;

  // `aud` may legally be a string or an array of strings in a JWT.
  const audRaw = raw.aud;
  const aud = Array.isArray(audRaw) ? String(audRaw[0] ?? "") : String(audRaw ?? "");

  const scopes = isJwtShape
    ? String(raw.scope ?? "").split(" ").filter(Boolean)
    : ((raw.scopes as string[]) ?? []);

  return {
    v: Number(isJwtShape ? ns.v : raw.v),
    jti: String(raw.jti ?? ""),
    iss: String(raw.iss ?? ""),
    aud,
    sub: String(raw.sub ?? ""),
    principal: (isJwtShape ? ns.principal : raw.principal) as MandateClaims["principal"],
    scopes,
    market: String(isJwtShape ? ns.market : raw.market),
    iat: Number(raw.iat),
    nbf: Number(raw.nbf),
    exp: Number(raw.exp),
    statement: String(isJwtShape ? ns.statement : raw.statement),
    // Absent on every first-party mandate and on anything issued before this
    // claim existed — both are the same case to a verifier and neither is an
    // error, so this stays undefined rather than a guessed default.
    onBehalfOf: isJwtShape ? (ns.onBehalfOf as MandateClaims["onBehalfOf"] | undefined) : undefined,
    status: (() => {
      const rawStatus = (isJwtShape ? ns.status : raw.status) as
        | { idx?: unknown; uri?: unknown }
        | undefined;
      if (!rawStatus || typeof rawStatus !== "object") return undefined;
      const idx = Number(rawStatus.idx);
      const uri = typeof rawStatus.uri === "string" ? rawStatus.uri : "";
      if (!Number.isInteger(idx) || idx < 0 || !uri) return undefined;
      return { idx, uri };
    })(),
  };
}

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
  constructor(
    /**
     * Why the key could not be loaded.
     *
     * Distinguished because the two cases send an operator to opposite places.
     * "Missing" means go and set the variable; "malformed" means the variable
     * is there and something ate it — most often a shell that stripped the
     * quotes around the JSON, which fails silently and looks exactly like
     * not-configured. Reporting both as the same error costs hours of looking
     * for something that is already present.
     */
    readonly reason: "missing" | "malformed" = "missing",
    detail?: string,
  ) {
    super(
      reason === "missing"
        ? "MANDATE_SIGNING_JWK / MANDATE_SIGNING_KID are not set"
        : `MANDATE_SIGNING_JWK is set but unusable: ${detail ?? "not a private Ed25519 JWK"}`,
    );
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
  const raw = env.MANDATE_SIGNING_JWK?.trim();
  const kid = env.MANDATE_SIGNING_KID?.trim();
  if (!raw || !kid) throw new MandateKeyUnavailableError("missing");

  let privateJwk: JWK;
  try {
    privateJwk = JSON.parse(raw) as JWK;
  } catch {
    // The overwhelmingly common cause: a shell or config loader stripped the
    // quotes around the JSON. Say so, because the value looks present and the
    // generic message sends people hunting for a variable that is already set.
    throw new MandateKeyUnavailableError(
      "malformed",
      raw.startsWith("{") && !raw.includes('"')
        ? "the quotes around the JSON were stripped — wrap the value in single quotes"
        : "not valid JSON",
    );
  }
  if (privateJwk.kty !== "OKP") {
    throw new MandateKeyUnavailableError("malformed", `expected an Ed25519 (OKP) key, got kty="${privateJwk.kty}"`);
  }
  if (!privateJwk.d) {
    // Pasting the public half is a real and dangerous mistake: it fails at
    // signing time rather than at load, so it would otherwise surface as a
    // mysterious 500 on the first mandate anyone tried to issue.
    throw new MandateKeyUnavailableError("malformed", "this is the public key — the private JWK has a \"d\" component");
  }
  return { kid, privateJwk };
}
