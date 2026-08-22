import "server-only";

import { decodeJwt, decodeProtectedHeader, type JWK } from "jose";
import {
  verifyMandate,
  publicJwkFor,
  loadSigningKeyFromEnv,
  MandateError,
  MandateKeyUnavailableError,
  MANDATE_CLAIM_NS,
  type MandateClaims,
} from "./mandate";
import {
  resolveRegisteredIssuer,
  fetchIssuerPublicJwks,
  RegistryVerifyError,
} from "./verifyWithRegistry";
import { sandboxJwks, SANDBOX_KID, SANDBOX_ISSUER_SUFFIX } from "./sandbox";
import { resolveRevocationState, type RevocationState } from "./revocationCheck";

/**
 * Inspect a mandate the way a stranger would — and never overstate the answer.
 *
 * WHY THIS IS NOT /api/mandate/verify
 *
 * `verify` answers one institution's question: "was this issued to *me*, and
 * may I act on it?" It therefore requires an audience and refuses to answer
 * without one, which is correct — an audience-less `valid: true` is a mandate
 * addressed to somebody else that a careless integrator would honour.
 *
 * A bank evaluating the protocol, a journalist handed a mandate id, or another
 * agent reading our `llms.txt` has a different question: "is this thing real,
 * and what does it actually say?" Today they have no way to ask it. The only
 * token a stranger can obtain is a sandbox one, and the production verifier
 * refuses it with a bare `UNKNOWN_ISSUER` — which is the right refusal and a
 * terrible first experience, because it looks identical to a forgery.
 *
 * So this exists as a separate, explicitly-named endpoint, and it is bound by
 * one rule: **it never returns a bare "valid".** Every answer states which
 * checks ran, which did not, and what the result does and does not license.
 * The reader is not asked to trust our summary — they are handed the JWKS URI
 * the signature was checked against so they can redo it themselves.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * It does not consult the audience. It does not decide whether anyone may act.
 * A `signatureVerified: true` from here plus a trusted issuer means the bytes
 * are authentic and the issuer is registered — it does not mean the holder is
 * the addressee. Anything that acts on a mandate must still call `verify`
 * with its own audience.
 */

export type MandateEnvironment = "production" | "sandbox" | "unknown";

export interface MandateInspection {
  /** True only when a published key of the resolved issuer verifies the bytes. */
  signatureVerified: boolean;
  /** Where the reader can fetch the key themselves and repeat the check. */
  jwksUri: string | null;
  keyId: string | null;
  algorithm: string | null;
  environment: MandateEnvironment;
  issuer: {
    iss: string;
    /** Present in the trust registry — the only thing that confers authority. */
    registered: boolean;
    name: string | null;
    status: string | null;
  };
  /**
   * The audience inside the token, reported and NOT checked. Named this way
   * so no caller can mistake "we read it" for "we matched it".
   */
  declaredAudience: string | null;
  audienceChecked: false;
  revocation: {
    state: RevocationState | "not_checked";
    via: "status_list" | "live_status" | null;
  };
  claims: {
    jti: string | null;
    scopes: string[];
    market: string | null;
    /** Masked contact only. An inspection endpoint never widens exposure. */
    principalName: string | null;
    principalContactMasked: string | null;
    statement: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
    expired: boolean | null;
    onBehalfOfAgent: string | null;
  } | null;
  /**
   * One machine-readable word for the whole picture. Never "valid" — the
   * closest this gets is `authentic_and_registered`, which still says nothing
   * about who may act on it.
   */
  verdict:
    | "authentic_and_registered"
    | "authentic_sandbox_no_authority"
    | "authentic_but_issuer_untrusted"
    | "authentic_but_revoked"
    | "authentic_but_expired"
    | "signature_failed"
    | "not_a_mandate";
  /** Why the verdict says what it says, in one sentence a human can quote. */
  reason: string;
}

/** Three non-empty base64url segments. Anything else is not a compact JWS. */
export function looksLikeCompactJws(value: string): boolean {
  const parts = value.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p));
}

function notAMandate(reason: string): MandateInspection {
  return {
    signatureVerified: false,
    jwksUri: null,
    keyId: null,
    algorithm: null,
    environment: "unknown",
    issuer: { iss: "", registered: false, name: null, status: null },
    declaredAudience: null,
    audienceChecked: false,
    revocation: { state: "not_checked", via: null },
    claims: null,
    verdict: "not_a_mandate",
    reason,
  };
}

/**
 * Resolve the keys to check against, and say which world they came from.
 *
 * The sandbox key is tried only when the token both names a `/sandbox` issuer
 * and carries the published sandbox kid. That is not a security boundary —
 * the sandbox key is public and grants nothing — it is so a production token
 * can never be reported as "sandbox" merely because it failed to verify.
 */
async function resolveKeys(
  iss: string,
  kid: string | null,
): Promise<{ jwks: JWK[]; jwksUri: string | null; environment: MandateEnvironment; registered: boolean; name: string | null; status: string | null }> {
  const registered = await resolveRegisteredIssuer(iss);
  if (registered) {
    let jwks: JWK[] = [];
    try {
      // Locally-issued tokens verify against the env key even when the
      // published JWKS is on another host (preview deploys, offline).
      const key = loadSigningKeyFromEnv();
      jwks = [await publicJwkFor(key)];
    } catch (err) {
      if (!(err instanceof MandateKeyUnavailableError)) throw err;
    }
    if (jwks.length === 0) {
      jwks = await fetchIssuerPublicJwks(registered.jwksUri);
    }
    return {
      jwks,
      jwksUri: registered.jwksUri,
      environment: "production",
      registered: true,
      name: registered.name,
      status: registered.status,
    };
  }

  if (iss.endsWith(SANDBOX_ISSUER_SUFFIX) && kid === SANDBOX_KID) {
    const { keys } = await sandboxJwks();
    return {
      jwks: keys,
      jwksUri: `${iss.slice(0, -SANDBOX_ISSUER_SUFFIX.length)}/api/mandate/sandbox/jwks.json`,
      environment: "sandbox",
      registered: false,
      name: "Zakai sandbox issuer",
      status: "sandbox",
    };
  }

  return {
    jwks: [],
    jwksUri: null,
    environment: "unknown",
    registered: false,
    name: null,
    status: null,
  };
}

export interface InspectOptions {
  /** Live revocation lookup for tokens without an embedded status pointer. */
  liveLookup?: (jti: string) => Promise<RevocationState>;
  now?: Date;
}

export async function inspectMandate(
  token: string,
  options: InspectOptions = {},
): Promise<MandateInspection> {
  const trimmed = token.trim();
  if (!looksLikeCompactJws(trimmed)) {
    return notAMandate("Not a compact JWS — a mandate is three base64url segments separated by dots.");
  }

  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = decodeProtectedHeader(trimmed) as { alg?: string; kid?: string };
    payload = decodeJwt(trimmed) as unknown as Record<string, unknown>;
  } catch {
    return notAMandate("The token could not be decoded as a JWS.");
  }

  const iss = String(payload.iss ?? "");
  const kid = header.kid ?? null;
  const alg = header.alg ?? null;

  let keys: Awaited<ReturnType<typeof resolveKeys>>;
  try {
    keys = await resolveKeys(iss, kid);
  } catch (err) {
    if (err instanceof RegistryVerifyError) {
      return {
        ...notAMandate(`Issuer keys could not be fetched: ${err.message}`),
        issuer: { iss, registered: false, name: null, status: null },
        keyId: kid,
        algorithm: alg,
        verdict: "authentic_but_issuer_untrusted",
        reason:
          `The token names issuer "${iss}", but its published keys could not be fetched, ` +
          "so nothing about the signature can be asserted either way.",
      };
    }
    throw err;
  }

  const issuerBlock = {
    iss,
    registered: keys.registered,
    name: keys.name,
    status: keys.status,
  };

  if (keys.jwks.length === 0) {
    return {
      signatureVerified: false,
      jwksUri: null,
      keyId: kid,
      algorithm: alg,
      environment: "unknown",
      issuer: issuerBlock,
      declaredAudience: readAudience(payload),
      audienceChecked: false,
      revocation: { state: "not_checked", via: null },
      claims: null,
      verdict: "authentic_but_issuer_untrusted",
      reason:
        `Issuer "${iss || "(none)"}" is not in the Zakai trust registry, so there is no key ` +
        "to check this signature against. An unregistered issuer grants no authority here.",
    };
  }

  // The audience is fed back from the token itself, which makes the audience
  // check a tautology on purpose — every other check in verifyMandate (the
  // EdDSA-only allowlist, typ, version, required claims, nbf/exp, the scope
  // rules) still runs exactly as an institution would run it. What is skipped
  // is stated in the response rather than quietly assumed.
  const declaredAudience = readAudience(payload);
  let claims: MandateClaims | null = null;
  let failure: MandateError | null = null;
  try {
    claims = await verifyMandate(trimmed, {
      audience: declaredAudience ?? "",
      publicJwks: keys.jwks,
      now: options.now,
    });
  } catch (err) {
    if (!(err instanceof MandateError)) throw err;
    failure = err;
  }

  if (failure && failure.code === "INVALID_SIGNATURE") {
    return {
      signatureVerified: false,
      jwksUri: keys.jwksUri,
      keyId: kid,
      algorithm: alg,
      environment: keys.environment,
      issuer: issuerBlock,
      declaredAudience,
      audienceChecked: false,
      revocation: { state: "not_checked", via: null },
      claims: null,
      verdict: "signature_failed",
      reason:
        `No published key of "${iss}" verifies these bytes. Either the token was altered ` +
        "after signing, or it was not signed by this issuer. Fetch the JWKS and repeat the check.",
    };
  }

  // Past the signature, so the bytes are authentic even when a claim is bad.
  // The reported shape is read from the payload either way, so a token that
  // expired shows the same fields as one that did not — the reader gets to
  // see *what* expired, not only that something did.
  const readable = readClaimsLeniently(payload, options.now);

  if (failure) {
    return {
      signatureVerified: true,
      jwksUri: keys.jwksUri,
      keyId: kid,
      algorithm: alg,
      environment: keys.environment,
      issuer: issuerBlock,
      declaredAudience,
      audienceChecked: false,
      revocation: { state: "not_checked", via: null },
      claims: readable,
      verdict: failure.code === "EXPIRED" ? "authentic_but_expired" : "authentic_but_issuer_untrusted",
      reason:
        failure.code === "EXPIRED"
          ? "The signature is authentic, but the mandate's own expiry has passed. Nobody may act on it."
          : `The signature is authentic, but the mandate is not usable: ${failure.message}.`,
    };
  }

  const verified = claims!;
  let revocation: MandateInspection["revocation"] = { state: "not_checked", via: null };
  if (keys.environment === "production" && keys.jwksUri) {
    const { state, via } = await resolveRevocationState({
      jti: verified.jti,
      status: verified.status,
      issuer: iss,
      jwksUri: keys.jwksUri,
      liveLookup: options.liveLookup ?? (async () => "unknown" as const),
      now: options.now,
    });
    revocation = { state, via };
  } else if (verified.status) {
    // Sandbox tokens carry a real, demo-able status pointer; checking it is
    // the whole point of the sandbox revoke walkthrough.
    const { state, via } = await resolveRevocationState({
      jti: verified.jti,
      status: verified.status,
      issuer: iss,
      jwksUri: keys.jwksUri ?? "",
      liveLookup: async () => "unknown" as const,
      now: options.now,
    });
    revocation = { state, via };
  }

  if (revocation.state === "revoked") {
    return {
      signatureVerified: true,
      jwksUri: keys.jwksUri,
      keyId: kid,
      algorithm: alg,
      environment: keys.environment,
      issuer: issuerBlock,
      declaredAudience,
      audienceChecked: false,
      revocation,
      claims: readable,
      verdict: "authentic_but_revoked",
      reason:
        "The signature is authentic and the issuer is known, but this mandate has been revoked. " +
        "A revoked mandate authorises nothing, however well-formed it looks.",
    };
  }

  if (keys.environment === "sandbox") {
    return {
      signatureVerified: true,
      jwksUri: keys.jwksUri,
      keyId: kid,
      algorithm: alg,
      environment: "sandbox",
      issuer: issuerBlock,
      declaredAudience,
      audienceChecked: false,
      revocation,
      claims: readable,
      verdict: "authentic_sandbox_no_authority",
      reason:
        "The signature is genuine and you can verify it yourself against the sandbox JWKS — change " +
        "one character and it fails. It authorises nothing: the sandbox issuer is deliberately " +
        "absent from the trust registry, names no real person, and is refused by the production verifier.",
    };
  }

  if (!keys.registered) {
    return {
      signatureVerified: true,
      jwksUri: keys.jwksUri,
      keyId: kid,
      algorithm: alg,
      environment: keys.environment,
      issuer: issuerBlock,
      declaredAudience,
      audienceChecked: false,
      revocation,
      claims: readable,
      verdict: "authentic_but_issuer_untrusted",
      reason: `The bytes are authentic, but "${iss}" is not a registered issuer, so it grants no authority.`,
    };
  }

  return {
    signatureVerified: true,
    jwksUri: keys.jwksUri,
    keyId: kid,
    algorithm: alg,
    environment: "production",
    issuer: issuerBlock,
    declaredAudience,
    audienceChecked: false,
    revocation,
    claims: readable,
    verdict: "authentic_and_registered",
    reason:
      "The signature verifies against the issuer's published key and the issuer is in the trust " +
      "registry. The audience was NOT checked here — an institution acting on this must call " +
      "/api/mandate/verify with its own audience.",
  };
}

function readAudience(payload: Record<string, unknown>): string | null {
  const aud = payload.aud;
  if (Array.isArray(aud)) return aud.length ? String(aud[0]) : null;
  return typeof aud === "string" && aud ? aud : null;
}

/**
 * Best-effort claim reading for a token whose signature verified but which
 * failed a later check. Reported so the reader can see *what* expired, not
 * only that something did.
 */
function readClaimsLeniently(
  payload: Record<string, unknown>,
  now?: Date,
): NonNullable<MandateInspection["claims"]> {
  const ns = (payload[MANDATE_CLAIM_NS] ?? {}) as Record<string, unknown>;
  const principal = (ns.principal ?? payload.principal ?? {}) as Record<string, unknown>;
  const onBehalfOf = (ns.onBehalfOf ?? {}) as Record<string, unknown>;
  const scope = typeof payload.scope === "string" ? payload.scope.split(" ").filter(Boolean) : [];
  const scopes = scope.length ? scope : Array.isArray(payload.scopes) ? (payload.scopes as string[]) : [];
  const exp = Number(payload.exp);
  const iat = Number(payload.iat);
  return {
    jti: typeof payload.jti === "string" ? payload.jti : null,
    scopes,
    market: typeof ns.market === "string" ? ns.market : typeof payload.market === "string" ? payload.market : null,
    principalName: typeof principal.name === "string" ? principal.name : null,
    principalContactMasked:
      typeof principal.contactMasked === "string" ? principal.contactMasked : null,
    statement: typeof ns.statement === "string" ? ns.statement : typeof payload.statement === "string" ? payload.statement : null,
    issuedAt: Number.isFinite(iat) ? new Date(iat * 1000).toISOString() : null,
    expiresAt: Number.isFinite(exp) ? new Date(exp * 1000).toISOString() : null,
    expired: Number.isFinite(exp) ? exp * 1000 <= (now?.getTime() ?? Date.now()) : null,
    onBehalfOfAgent: typeof onBehalfOf.agent === "string" ? onBehalfOf.agent : null,
  };
}
