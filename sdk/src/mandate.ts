/**
 * The Zakai Mandate — a signed, scoped, audience-bound, revocable statement
 * that a named person has authorised an agent to act on their behalf.
 * Ported from the production app's src/lib/mandate/mandate.ts, with one
 * addition: `verifyMandateFromUrl`, a convenience wrapper that fetches the
 * issuer's JWKS itself so verifying a mandate is genuinely the couple of
 * lines the discovery document promises, not an exercise in JOSE plumbing.
 *
 * A mandate is a plain JWT. `scope` is the OAuth 2.0 spelling, space
 * delimited, so anything that already speaks OAuth reads the grant without
 * learning anything about Zakai. Everything else lives under the `zkm`
 * namespace claim.
 */

import { SignJWT, compactVerify, exportJWK, importJWK, type JWK } from "jose";
import { validateScopes } from "./scopes.js";

export const MANDATE_TYPE = "JWT";
/** The pre-JWT envelope. Still accepted on verify so nothing already issued breaks. */
export const LEGACY_MANDATE_TYPE = "zakai-mandate+jws";
export const MANDATE_CLAIM_NS = "zkm";
export const MANDATE_VERSION = 1;
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

export interface MandateClaims {
  v: number;
  jti: string;
  iss: string;
  aud: string;
  sub: string;
  principal: {
    name: string;
    reference?: string;
    contactMasked?: string;
  };
  scopes: string[];
  market: string;
  iat: number;
  nbf: number;
  exp: number;
  statement: string;
  onBehalfOf?: {
    agent: string;
    name: string;
    note: string;
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
  onBehalfOf?: MandateClaims["onBehalfOf"];
  now?: Date;
}

export interface SigningKey {
  kid: string;
  privateJwk: JWK;
}

/**
 * Issue a mandate. Throws rather than issuing something a counterparty would
 * have to reject.
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
    onBehalfOf: input.onBehalfOf,
  };

  const privateKey = await importJWK(key.privateJwk, "EdDSA");
  return new SignJWT({
    scope: claims.scopes.join(" "),
    [MANDATE_CLAIM_NS]: {
      v: claims.v,
      principal: claims.principal,
      market: claims.market,
      statement: claims.statement,
      ...(claims.onBehalfOf ? { onBehalfOf: claims.onBehalfOf } : {}),
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
  toleranceSeconds?: number;
  now?: Date;
}

/**
 * Verify a mandate against an already-fetched set of public keys. The
 * reference implementation of the check — written so it can be reimplemented
 * in any language from the JWS alone, and so this SDK is never the only way
 * to verify a Zakai mandate.
 */
export async function verifyMandate(token: string, options: VerifyOptions): Promise<MandateClaims> {
  let payload: Uint8Array | undefined;
  let typ: string | undefined;

  for (const jwk of options.publicJwks) {
    try {
      const key = await importJWK(jwk, "EdDSA");
      const result = await compactVerify(token, key);
      payload = result.payload;
      typ = result.protectedHeader.typ;
      break;
    } catch {
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

  const claims = normaliseClaims(raw);
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

  const problems = validateScopes(claims.scopes);
  if (problems.length) throw new MandateError(problems.join("; "), "INVALID_SCOPES");

  return claims;
}

/**
 * Fetch a JWKS document and return its keys. No caching here on purpose —
 * this SDK does not want to own a cache-invalidation policy for you. For
 * production traffic, wrap this (or use `jose`'s `createRemoteJWKSet`
 * directly) behind whatever TTL cache your runtime already has.
 */
export async function fetchJwks(jwksUri: string): Promise<JWK[]> {
  const res = await fetch(jwksUri);
  if (!res.ok) throw new Error(`failed to fetch JWKS from ${jwksUri}: HTTP ${res.status}`);
  const data = (await res.json()) as { keys?: JWK[] };
  return data.keys ?? [];
}

export interface VerifyFromUrlOptions {
  audience: string;
  jwksUri: string;
  toleranceSeconds?: number;
  now?: Date;
}

/**
 * The three-line path: fetch the issuer's JWKS and verify in one call. This
 * is the function most integrations want; `verifyMandate` above is there for
 * anyone already caching JWKS themselves.
 */
export async function verifyMandateFromUrl(
  token: string,
  options: VerifyFromUrlOptions,
): Promise<MandateClaims> {
  const publicJwks = await fetchJwks(options.jwksUri);
  return verifyMandate(token, {
    audience: options.audience,
    publicJwks,
    toleranceSeconds: options.toleranceSeconds,
    now: options.now,
  });
}

function normaliseClaims(raw: Record<string, unknown>): MandateClaims {
  const ns = (raw[MANDATE_CLAIM_NS] ?? {}) as Record<string, unknown>;
  const isJwtShape = typeof raw.scope === "string" || MANDATE_CLAIM_NS in raw;

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
    onBehalfOf: isJwtShape ? (ns.onBehalfOf as MandateClaims["onBehalfOf"] | undefined) : undefined,
  };
}

export function mandateAllows(claims: MandateClaims, scope: string): boolean {
  return claims.scopes.includes(scope);
}

/** The public half of a signing key, in the shape a JWKS endpoint serves. */
export async function publicJwkFor(key: SigningKey): Promise<JWK> {
  const priv = await importJWK(key.privateJwk, "EdDSA");
  const jwk = await exportJWK(priv);
  delete jwk.d;
  return { ...jwk, kid: key.kid, alg: "EdDSA", use: "sig" };
}
