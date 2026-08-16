import "server-only";
import { SignJWT, type JWK } from "jose";
import { validateScopes } from "./scopes";
import { MandateError, MANDATE_CLAIM_NS, MANDATE_VERSION } from "./mandate";
import { signStatusList } from "./statusList";

/**
 * A mandate you can hold, verify, and break — that can never authorise anything.
 *
 * WHY THIS EXISTS
 *
 * Everything needed to adopt this protocol already shipped: an SDK, reference
 * verifiers in six languages, a conformance suite, signed test vectors, an
 * OpenAPI document. And an outside developer still could not try it, because
 * `/api/mandate/sandbox-issuer` was `status: "documentation_only"` and the
 * published test vectors are signed with a key labelled, correctly, as one no
 * conforming verifier will ever accept. So the first step of the integration
 * was "obtain a token", and there was no way to obtain one.
 *
 * This mints real Ed25519-signed mandates that a real verifier accepts as
 * cryptographically valid — so tampering with one visibly fails — while being
 * structurally incapable of authorising anything in production.
 *
 * THE CONTAINMENT, AND WHY IT IS STRUCTURAL
 *
 * A flag that says "this is only a demo" is worth nothing: flags get deleted,
 * inverted, or forgotten during a refactor. Every barrier here is instead
 * something that must be actively *built* to breach, not merely un-checked:
 *
 *  1. The signing key is a fixed, deliberately published one, and this module
 *     does not read MANDATE_SIGNING_JWK — there is no code path from the
 *     production key to this signer, so no edit to a condition can reach it.
 *     See SANDBOX_PRIVATE_JWK for why secrecy is not what contains this.
 *  2. The issuer is `<origin>/sandbox`, which is deliberately absent from the
 *     trust registry. `verifyMandateWithTrustRegistry` resolves iss → registry
 *     → JWKS, so an unregistered issuer fails at resolution. Acceptance
 *     requires someone to ADD this issuer, which is a visible, reviewable act
 *     — not the removal of a guard.
 *  3. The audience is forced to a reserved value, so a sandbox token cannot
 *     even name a real institution to be presented to.
 *  4. Ten-minute lifetime, so a leaked sample is inert almost immediately.
 *  5. Scopes still pass validateScopes, so FORBIDDEN_SCOPES apply here exactly
 *     as they do in production. A sandbox is not a place to practise asking
 *     for authority the protocol refuses to grant.
 *  6. `zkm.env: "sandbox"` is inside the signature as defence in depth — the
 *     one machine-readable belt to go with the structural braces.
 *
 * The test that matters is not that these are configured. It is that a token
 * from here is REJECTED by the production verifier, and that is asserted
 * directly in sandbox.test.ts against the real verify path.
 */

/** Audience reserved for the sandbox. Never a real institution. */
export const SANDBOX_AUDIENCE = "sandbox-institution";

/** Path segment appended to the origin to form the sandbox issuer. */
export const SANDBOX_ISSUER_SUFFIX = "/sandbox";

/** Short enough that a copied token stops working before it can be misused. */
export const SANDBOX_TTL_SECONDS = 600;

/** Names the key honestly: public, fixed, and trusted by nobody. */
export const SANDBOX_KID = "zakai-sandbox-public-do-not-trust";

/**
 * Size of the demo status list. Small on purpose — this is a self-test
 * fixture, not a capacity plan; see STATUS_LIST_CAPACITY for the real one.
 */
export const SANDBOX_STATUS_LIST_SIZE = 4096;

/**
 * A fixed keypair, published on purpose — like the test vectors already are.
 *
 * The first version of this generated an ephemeral key per process. That is a
 * fine instinct and it was wrong here, for a reason only running it revealed:
 * this deploys to Vercel, where the issuing request and the JWKS request are
 * routinely served by different instances. Different instances meant different
 * keys, so a freshly issued token failed to verify against the JWKS fetched a
 * second later — indistinguishable, to an integrator, from tampering. The
 * feature would have been broken in production while passing every test.
 *
 * Making it constant is safe because secrecy was never what contained this.
 * A sandbox token is refused by the production verifier for being issued by an
 * unregistered issuer — a property of the trust registry, not of who holds the
 * key. Anyone may mint sandbox mandates with this; they authorise nothing,
 * exactly as intended, and `sandbox.test.ts` asserts that against the real
 * verify path.
 *
 * It is NOT the production key and cannot become it: nothing here reads
 * MANDATE_SIGNING_JWK, so there is no code path between the two.
 */
const SANDBOX_PRIVATE_JWK: JWK = {
  kty: "OKP",
  crv: "Ed25519",
  d: "wC8uQwchhsSdXzNz6mfh1n2sxaq2Cx4AcMk15aoBh90",
  x: "oWtTInTC7O4LEKZrlCM6tErRZUAzB-aJ_PL23nVYyWs",
  kid: SANDBOX_KID,
  alg: "EdDSA",
};

const SANDBOX_PUBLIC_JWK: JWK = {
  kty: "OKP",
  crv: "Ed25519",
  x: SANDBOX_PRIVATE_JWK.x,
  kid: SANDBOX_KID,
  alg: "EdDSA",
  use: "sig",
};

async function sandboxKey(): Promise<{ privateJwk: JWK; publicJwk: JWK }> {
  return { privateJwk: SANDBOX_PRIVATE_JWK, publicJwk: SANDBOX_PUBLIC_JWK };
}

export function sandboxIssuer(origin: string): string {
  return `${origin.replace(/\/+$/, "")}${SANDBOX_ISSUER_SUFFIX}`;
}

/** The public half, for a verifier to check a sandbox token against. */
export async function sandboxJwks(): Promise<{ keys: JWK[] }> {
  const { publicJwk } = await sandboxKey();
  return { keys: [publicJwk] };
}

export interface SandboxMandateInput {
  origin: string;
  scopes: string[];
  /** Display name of the principal. Sample data only — never a real person. */
  principalName?: string;
  /** The agent this is issued on behalf of, when demonstrating delegation. */
  agent?: string;
  now?: Date;
}

export interface SandboxMandate {
  token: string;
  issuer: string;
  audience: string;
  kid: string;
  expiresAt: string;
  scopes: string[];
  /** Index into the sandbox status list — pass to the revoke demo to break this token. */
  statusIndex: number;
  /** Where a verifier fetches the signed status list this index lives in. */
  statusListUri: string;
}

export async function issueSandboxMandate(
  input: SandboxMandateInput,
): Promise<SandboxMandate> {
  // The same scope rules as production. A sandbox that accepted forbidden
  // scopes would teach integrators a shape the real issuer refuses.
  const problems = validateScopes(input.scopes);
  if (problems.length) throw new MandateError(problems.join("; "), "INVALID_SCOPES");

  const { privateJwk } = await sandboxKey();
  const { importJWK } = await import("jose");
  const privateKey = await importJWK(privateJwk, "EdDSA");

  const nowSec = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  const exp = nowSec + SANDBOX_TTL_SECONDS;
  const iss = sandboxIssuer(input.origin);
  const statusIndex = Math.floor(Math.random() * SANDBOX_STATUS_LIST_SIZE);
  const statusListUri = `${input.origin.replace(/\/+$/, "")}/api/mandate/sandbox/status-list.json`;

  // Same claim shape issueMandate() produces — `scope` as an OAuth-shaped
  // space-delimited string at top level, everything else namespaced under
  // `zkm`. A sandbox token that used a different shape from the production
  // issuer would verify as garbage against the reference verifier's own
  // normaliseClaims(), which keys its "nested vs flat" branch on the mere
  // presence of the `zkm` claim — exactly the marker this token already
  // carries for defence-in-depth. That mismatch previously made every
  // sandbox-issued token fail with UNSUPPORTED_VERSION before any real check
  // (audience, expiry, ...) ever ran against it.
  const token = await new SignJWT({
    scope: input.scopes.join(" "),
    [MANDATE_CLAIM_NS]: {
      v: MANDATE_VERSION,
      principal: {
        name: input.principalName?.trim() || "Sample Principal",
        contactMasked: "05*-***-**89",
      },
      market: "IL",
      statement:
        "SANDBOX MANDATE — issued for integration testing only. This grants no authority and names no real person.",
      ...(input.agent ? { onBehalfOf: { agent: input.agent, name: input.agent, note: "sandbox" } } : {}),
      // Defence in depth. The structural barriers above are what actually
      // contain this; a verifier that somehow reached signature checking
      // still has an unambiguous machine-readable reason to refuse.
      env: "sandbox",
      // A demo-able revocation path, not just a signature to verify. An
      // integrator can fetch statusListUri?revoke=<idx> to see this exact
      // token flip to revoked — the same offline-bit-lookup flow production
      // mandates use, with nothing to sign up for or wait on.
      status: { idx: statusIndex, uri: statusListUri },
    },
  })
    .setProtectedHeader({ alg: "EdDSA", kid: SANDBOX_KID, typ: "JWT" })
    .setIssuer(iss)
    .setAudience(SANDBOX_AUDIENCE)
    .setSubject("sandbox-subject")
    .setJti(`sandbox-${crypto.randomUUID()}`)
    .setIssuedAt(nowSec)
    .setNotBefore(nowSec)
    .setExpirationTime(exp)
    .sign(privateKey);

  return {
    token,
    issuer: iss,
    audience: SANDBOX_AUDIENCE,
    kid: SANDBOX_KID,
    expiresAt: new Date(exp * 1000).toISOString(),
    scopes: [...input.scopes],
    statusIndex,
    statusListUri,
  };
}

/**
 * Sign the sandbox's own status list — the companion to the `status` pointer
 * every sandbox mandate now carries.
 *
 * Deliberately stateless, unlike the production list at
 * /api/mandate/revocations (which reads real revocations from
 * MandateRevocation). There is nothing here to persist: an integrator's own
 * test harness decides which indices are "revoked" for a given request, the
 * same way it decides which sample mandate to hold in the first place. What
 * makes this a real test of their verifier and not theatre is that the
 * result is a genuinely signed, genuinely offline-verifiable statuslist+jwt —
 * exactly the artifact production would serve, just without a database
 * behind it.
 */
export async function signSandboxStatusList(input: {
  origin: string;
  revokedIndices: readonly number[];
  now?: Date;
}): Promise<string> {
  const { privateJwk } = await sandboxKey();
  return signStatusList(
    {
      issuer: sandboxIssuer(input.origin),
      revokedIndices: input.revokedIndices,
      size: SANDBOX_STATUS_LIST_SIZE,
      ttlSeconds: SANDBOX_TTL_SECONDS,
      now: input.now,
    },
    { kid: SANDBOX_KID, privateJwk },
  );
}
