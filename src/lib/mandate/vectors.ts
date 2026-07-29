/**
 * Test vectors — the thing that decides whether anybody else implements this.
 *
 * WHY THIS FILE MATTERS MORE THAN THE SPECIFICATION
 *
 * The conformance suite says what an implementation must do. It does not let
 * somebody writing the Go version at three in the morning find out whether
 * theirs actually does it. Prose is ambiguous in exactly the places that matter
 * — is the audience compared before or after expiry, is a missing claim a
 * refusal or a pass, does an unknown revocation state mean yes — and every
 * implementer resolves those ambiguities differently and silently.
 *
 * Every protocol that spread shipped vectors. RFC 7515 has an appendix of them.
 * WebAuthn, OAuth, TLS, all of them. Protocols that shipped only prose produced
 * a dozen incompatible implementations and then a decade of interop bugs.
 *
 * So this is the artefact that makes a stranger's implementation provably
 * correct without anybody here reading their code, which is the only way a
 * registry ever gets a second issuer.
 *
 * WHY THE VECTORS ARE DETERMINISTIC
 *
 * Fixed key, fixed timestamps, fixed identifiers. The same token bytes come out
 * on every machine, in every language, forever. A vector that depends on the
 * current time is not a vector — it is a test that passes today and fails on
 * the day somebody actually runs it.
 *
 * THE TEST KEY IS PUBLIC AND THAT IS THE POINT
 *
 * The private key below is published deliberately, exactly as RFC test vectors
 * publish theirs. It exists so anybody can produce and verify the fixtures
 * themselves. Three things stop it being a hazard: it is named so that no
 * reader can mistake it, its issuer is under `.invalid` — a TLD reserved by
 * RFC 2606 that can never resolve — and the trust registry has no entry for
 * that issuer, so `resolveIssuerKeysUri` returns null and nothing in the real
 * verification path will ever fetch or honour it.
 */

import type { JWK } from "jose";
import type { DecisionRequest, DenyReason } from "./decision";
import type { MandateClaims } from "./mandate";

/**
 * Never a real issuer. `.invalid` is reserved by RFC 2606 and cannot resolve,
 * and the trust registry deliberately has no entry for it.
 */
export const TEST_ISSUER = "https://test.zakai.invalid";
export const TEST_AUDIENCE = "test-institution";
export const TEST_KID = "zakai-test-vector-key-do-not-trust";

/**
 * Published on purpose. Anyone can regenerate every fixture below from this,
 * which is what makes the vectors checkable rather than merely quotable.
 */
export const TEST_PRIVATE_JWK: JWK = {
  kty: "OKP",
  crv: "Ed25519",
  d: "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",
  x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
};

export const TEST_PUBLIC_JWK: JWK = {
  kty: "OKP",
  crv: "Ed25519",
  x: "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
};

/** The instant every vector is evaluated at. Fixed, so results never drift. */
export const TEST_NOW = 1_800_000_000; // 2027-01-15T08:00:00Z

const HOUR = 3600;

function baseClaims(over: Partial<MandateClaims> = {}): MandateClaims {
  return {
    v: 1,
    jti: "mnd_vector_1",
    iss: TEST_ISSUER,
    aud: TEST_AUDIENCE,
    sub: "usr_vector_1",
    principal: { name: "Test Principal", reference: "000000000" },
    scopes: ["read:accounts", "dispute:charge"],
    market: "IL",
    iat: TEST_NOW - HOUR,
    nbf: TEST_NOW - HOUR,
    exp: TEST_NOW + HOUR,
    statement: "Test vector mandate. Not valid for any real institution.",
    ...over,
  };
}

export interface DecisionVector {
  id: string;
  /** What ambiguity this vector pins down. Written for the implementer. */
  pins: string;
  request: Omit<DecisionRequest, "now">;
  expect: { decision: "permit" | "deny"; reason?: DenyReason };
}

/**
 * One vector per outcome the decision layer can produce, plus the cases where
 * two rules could plausibly fire and the order matters.
 *
 * The ordering vectors are the ones worth the most. Any implementation gets the
 * simple cases right; what diverges between implementations is which reason
 * comes back when a token is both expired and addressed to the wrong party, and
 * an integrator branching on `reason` needs that to be the same everywhere.
 */
export const DECISION_VECTORS: readonly DecisionVector[] = [
  {
    id: "permit_read_scope",
    pins: "A standing read scope needs no per-act confirmation.",
    request: {
      claims: baseClaims(),
      action: "read:accounts",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "permit" },
  },
  {
    id: "permit_per_act_with_confirmation",
    pins: "A per-act scope permits once this specific act is confirmed.",
    request: {
      claims: baseClaims(),
      action: "dispute:charge",
      audience: TEST_AUDIENCE,
      revocation: "active",
      actConfirmation: "cnf_vector_1",
    },
    expect: { decision: "permit" },
  },
  {
    id: "deny_per_act_without_confirmation",
    pins: "Holding a per-act scope is not agreement to this act. The single most commonly mis-implemented rule.",
    request: {
      claims: baseClaims(),
      action: "dispute:charge",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "deny", reason: "act_confirmation_required" },
  },
  {
    id: "permit_correspond_scope_without_confirmation",
    pins: "Tier and per-act confirmation are different questions. `request:records` is correspondence-tier and still standing — asking somebody to confirm each individual request for their own records is friction with no safety behind it. An independent implementation got this wrong by assuming the two travel together.",
    request: {
      claims: baseClaims({ scopes: ["request:records"] }),
      action: "request:records",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "permit" },
  },
  {
    id: "deny_scope_not_granted",
    pins: "A known scope the mandate does not carry.",
    request: {
      claims: baseClaims(),
      action: "read:payroll",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "deny", reason: "scope_not_granted" },
  },
  {
    id: "deny_scope_unknown",
    pins: "A scope outside the vocabulary is refused even when the token carries it.",
    request: {
      claims: baseClaims({ scopes: ["invented:verb"] }),
      action: "invented:verb",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "deny", reason: "scope_unknown" },
  },
  {
    id: "deny_forbidden_action",
    pins: "Outward money movement is refused at the decision point, not merely absent from issuance.",
    request: {
      claims: baseClaims(),
      action: "payment:initiate",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "deny", reason: "scope_forbidden" },
  },
  {
    id: "deny_forbidden_scope_poisons_token",
    pins: "A token carrying a forbidden scope is refused for every action, including innocent ones.",
    request: {
      claims: baseClaims({ scopes: ["read:accounts", "payment:transfer"] }),
      action: "read:accounts",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "deny", reason: "scope_forbidden" },
  },
  {
    id: "deny_audience_mismatch",
    pins: "A mandate presented to the wrong institution.",
    request: {
      claims: baseClaims(),
      action: "read:accounts",
      audience: "someone-else",
      revocation: "active",
    },
    expect: { decision: "deny", reason: "audience_mismatch" },
  },
  {
    id: "deny_subject_mismatch",
    pins: "The act concerns a different person from the one the mandate names.",
    request: {
      claims: baseClaims(),
      action: "read:accounts",
      audience: TEST_AUDIENCE,
      subject: "usr_someone_else",
      revocation: "active",
    },
    expect: { decision: "deny", reason: "subject_mismatch" },
  },
  {
    id: "deny_market_mismatch",
    pins: "A mandate issued for another jurisdiction, where the caller enforces one.",
    request: {
      claims: baseClaims(),
      action: "read:accounts",
      audience: TEST_AUDIENCE,
      market: "GB",
      revocation: "active",
    },
    expect: { decision: "deny", reason: "market_mismatch" },
  },
  {
    id: "deny_expired",
    pins: "Expiry is evaluated against the supplied clock, not the wall clock.",
    request: {
      claims: baseClaims({ exp: TEST_NOW - 1 }),
      action: "read:accounts",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "deny", reason: "expired" },
  },
  {
    id: "deny_not_yet_valid",
    pins: "A mandate whose validity has not begun.",
    request: {
      claims: baseClaims({ nbf: TEST_NOW + 60 }),
      action: "read:accounts",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "deny", reason: "not_yet_valid" },
  },
  {
    id: "deny_missing_expiry",
    pins: "A claim set with no expiry is malformed, never eternal. Treating the absence as 'no expiry' turns a broken token into the strongest possible mandate.",
    request: {
      claims: baseClaims({ exp: undefined as unknown as number }),
      action: "read:accounts",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "deny", reason: "malformed_claims" },
  },
  {
    id: "deny_revoked",
    pins: "A mandate the issuer has revoked, where the caller established that.",
    request: {
      claims: baseClaims(),
      action: "read:accounts",
      audience: TEST_AUDIENCE,
      revocation: "revoked",
    },
    expect: { decision: "deny", reason: "revoked" },
  },
  {
    id: "deny_revocation_unknown",
    pins: "An unestablished revocation status is a deny, not a permit with a warning. This is where implementations most often fail open.",
    request: {
      claims: baseClaims(),
      action: "read:accounts",
      audience: TEST_AUDIENCE,
      revocation: "unknown",
    },
    expect: { decision: "deny", reason: "revocation_unknown" },
  },
  // ---- Ordering. The vectors that stop implementations diverging. ----------
  {
    id: "order_audience_before_expiry",
    pins: "Both wrong: the audience mismatch is reported, because 'you sent this to the wrong institution' is more actionable than 'it expired'.",
    request: {
      claims: baseClaims({ exp: TEST_NOW - 1 }),
      action: "read:accounts",
      audience: "someone-else",
      revocation: "active",
    },
    expect: { decision: "deny", reason: "audience_mismatch" },
  },
  {
    id: "order_forbidden_before_expiry",
    pins: "An expired token carrying a forbidden scope reports the forbidden scope. The categorical limit is never masked by a lesser fault.",
    request: {
      claims: baseClaims({ exp: TEST_NOW - 1, scopes: ["credit:borrow"] }),
      action: "credit:borrow",
      audience: TEST_AUDIENCE,
      revocation: "active",
    },
    expect: { decision: "deny", reason: "scope_forbidden" },
  },
  {
    id: "order_scope_before_revocation",
    pins: "A revoked token asking for a scope it never held reports the scope, so an integrator is not sent chasing a revocation that is not the problem.",
    request: {
      claims: baseClaims(),
      action: "read:payroll",
      audience: TEST_AUDIENCE,
      revocation: "revoked",
    },
    expect: { decision: "deny", reason: "scope_not_granted" },
  },
];

export interface VectorResult {
  id: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface VectorReport {
  total: number;
  passed: number;
  failed: VectorResult[];
  /** Conformant only when every vector passes. There is no partial credit. */
  conformant: boolean;
}

/**
 * Run a candidate implementation against the vectors.
 *
 * Takes the implementation as a function so an issuer can point this at their
 * own code, or a service can point it at an HTTP endpoint, without either
 * having to depend on ours. That independence is the whole design: a
 * conformance tool that only works if you already run our library certifies
 * nothing.
 */
export function runDecisionVectors(
  impl: (req: DecisionRequest) => { decision: "permit" | "deny"; reason?: string },
): VectorReport {
  const failed: VectorResult[] = [];

  for (const vector of DECISION_VECTORS) {
    const expected = vector.expect.reason
      ? `${vector.expect.decision}:${vector.expect.reason}`
      : vector.expect.decision;

    let actual: string;
    try {
      const got = impl({ ...vector.request, now: new Date(TEST_NOW * 1000) });
      actual = got.reason ? `${got.decision}:${got.reason}` : got.decision;
    } catch (err) {
      // A throw is a failure, not a crash of the harness. An implementation
      // that throws on a hostile input is one whose caller will wrap it in a
      // try/catch, and that catch block will eventually permit something.
      actual = `threw:${err instanceof Error ? err.message : String(err)}`;
    }

    if (actual !== expected) failed.push({ id: vector.id, passed: false, expected, actual });
  }

  return {
    total: DECISION_VECTORS.length,
    passed: DECISION_VECTORS.length - failed.length,
    failed,
    conformant: failed.length === 0,
  };
}

/** The published form, for an implementer in any language. */
export function vectorDocument() {
  return {
    spec: "zakai-mandate-test-vectors",
    version: 1,
    evaluated_at_unix: TEST_NOW,
    issuer: TEST_ISSUER,
    audience: TEST_AUDIENCE,
    kid: TEST_KID,
    // Published exactly as RFC test vectors publish theirs, so the fixtures can
    // be regenerated rather than merely quoted. The issuer is under a TLD that
    // cannot resolve and has no trust-registry entry, so nothing in the real
    // verification path can ever be induced to honour it.
    test_private_jwk: TEST_PRIVATE_JWK,
    test_public_jwk: TEST_PUBLIC_JWK,
    warning:
      "This key is public and exists only to reproduce these vectors. It is not an issuer key and no conforming verifier will accept mandates signed with it.",
    note: "Evaluate every vector at evaluated_at_unix. A vector evaluated against the wall clock is a test that passes today and fails when somebody actually runs it.",
    vectors: DECISION_VECTORS.map((v) => ({
      id: v.id,
      pins: v.pins,
      claims: v.request.claims,
      action: v.request.action,
      audience: v.request.audience,
      subject: v.request.subject,
      market: v.request.market,
      revocation: v.request.revocation ?? "unknown",
      act_confirmation: v.request.actConfirmation,
      expect: v.expect,
    })),
  };
}
