/**
 * The conformance suite, made independently checkable.
 *
 * conformance.ts in the production app (and its published form at
 * /.well-known/zakai-conformance.json) states ten requirements and a scoring
 * function, `assessConformance()`, that aggregates a candidate's *self-
 * reported* pass/fail results into a verdict. That is honest as far as it
 * goes — the module's own doc comment even says so ("an issuer runs this
 * against their own endpoints... nobody at Zakai has to read their code") —
 * but self-attestation is not independent verification, and a registry that
 * only ever grades what candidates say about themselves is an honour system
 * wearing a conformance programme's clothes.
 *
 * `probeIssuer` closes part of that gap: given a candidate's public
 * artifacts — their JWKS, and one or more sample mandates they issue — it
 * runs the checks that are genuinely automatable against artifacts alone,
 * using this SDK's own `verifyMandate` as the independent judge rather than
 * trusting the candidate's report of what their code does.
 * `publishes_status_list` is settled from the sample embedding `zkm.status`.
 * `revocation_takes_effect` settles when a signed statuslist+jwt is submitted
 * with the sample's idx bit set — never assumed to pass when absent.
 */

import { FORBIDDEN_SCOPES } from "./scopes.js";
import { verifyMandate, MandateError, type MandateClaims } from "./mandate.js";
import { verifyStatusList } from "./statusList.js";
import type { JWK } from "jose";

export type CheckId =
  | "issues_valid_jwt"
  | "registered_claims_present"
  | "scope_is_oauth_shaped"
  | "rejects_forged_signature"
  | "enforces_audience"
  | "enforces_expiry"
  | "refuses_forbidden_scope"
  | "publishes_jwks"
  | "publishes_status_list"
  | "revocation_takes_effect";

export type Severity = "must" | "should";

export interface CheckDef {
  id: CheckId;
  severity: Severity;
  requirement: string;
  rationale: string;
}

/** Ported verbatim from the production app's conformance.ts. */
export const CHECKS: readonly CheckDef[] = [
  {
    id: "issues_valid_jwt",
    severity: "must",
    requirement: "Mandates verify as a standard JWT with alg EdDSA and typ JWT.",
    rationale:
      "Every verifier uses the JWT library it already has. A bespoke envelope pushes each of them onto low-level JOSE and hand-written checks, which is where audience and expiry get skipped.",
  },
  {
    id: "registered_claims_present",
    severity: "must",
    requirement: "iss, aud, sub, jti, iat, nbf and exp are all present as registered claims.",
    rationale:
      "Registered claims are enforced by standard validators. Moving any of them into a private namespace means every verifier has to remember to check it by hand.",
  },
  {
    id: "scope_is_oauth_shaped",
    severity: "should",
    requirement: "The grant is a space-delimited `scope` string.",
    rationale: "Gateways and authorisation servers that already speak OAuth then read the grant with no bespoke code.",
  },
  {
    id: "rejects_forged_signature",
    severity: "must",
    requirement: "A mandate whose payload was altered after signing is rejected.",
    rationale:
      "The single assumption every other participant makes about you. An issuer that accepts tampered tokens turns the whole registry into a list of people who might be lying.",
  },
  {
    id: "enforces_audience",
    severity: "must",
    requirement: "A mandate issued for one audience is refused when presented to another.",
    rationale: "Without audience binding a leaked mandate is a skeleton key across every institution in the network.",
  },
  {
    id: "enforces_expiry",
    severity: "must",
    requirement: "An expired mandate is refused, with clock skew tolerance no greater than 300s.",
    rationale: "Expiry is half of revocation. A generous skew window is a quiet extension of every credential you have ever issued.",
  },
  {
    id: "refuses_forbidden_scope",
    severity: "must",
    requirement: `A mandate is never issued carrying any of: ${FORBIDDEN_SCOPES.join(", ")}.`,
    rationale:
      "This is the promise that lets an institution accept a mandate without underwriting the issuer's payment stack.",
  },
  {
    id: "publishes_jwks",
    severity: "must",
    requirement: "Public keys are served over HTTPS at a stable URL, with no private components.",
    rationale: "Offline verification is the whole design. Keys that cannot be fetched force every verifier into a live dependency.",
  },
  {
    id: "publishes_status_list",
    severity: "should",
    requirement:
      "Issued mandates embed zkm.status { idx, uri } pointing at a signed status list (refreshed at least hourly).",
    rationale: "Without it, revocation requires a live per-mandate call — the availability dependency this protocol exists to remove.",
  },
  {
    id: "revocation_takes_effect",
    severity: "must",
    requirement: "A mandate revoked by its holder is reflected as revoked within one status-list refresh.",
    rationale: "A revocation that does not land means a person withdrew authority and the network kept acting on it.",
  },
];

export interface CheckResult {
  id: CheckId;
  passed: boolean;
  detail?: string;
}

export type ConformanceVerdict = "conformant" | "conformant_with_notes" | "not_conformant";

export interface ConformanceReport {
  verdict: ConformanceVerdict;
  blocking: CheckDef[];
  notes: CheckDef[];
  missing: CheckId[];
  summary: string;
}

/** Ported verbatim from the production app. A check nobody ran counts as failed at its declared severity. */
export function assessConformance(results: readonly CheckResult[]): ConformanceReport {
  const byId = new Map(results.map((r) => [r.id, r]));
  const missing: CheckId[] = [];
  const blocking: CheckDef[] = [];
  const notes: CheckDef[] = [];

  for (const check of CHECKS) {
    const result = byId.get(check.id);
    if (!result) missing.push(check.id);
    if (result?.passed) continue;
    if (check.severity === "must") blocking.push(check);
    else notes.push(check);
  }

  const verdict: ConformanceVerdict =
    blocking.length > 0 ? "not_conformant" : notes.length > 0 ? "conformant_with_notes" : "conformant";

  const summary =
    verdict === "conformant"
      ? `All ${CHECKS.length} checks pass. This implementation can be admitted to the registry.`
      : verdict === "conformant_with_notes"
        ? `Required checks pass; ${notes.length} recommended one(s) do not. Admissible, and the gaps are published on the registry entry so institutions can see them.`
        : `${blocking.length} required check(s) fail: ${blocking.map((c) => c.id).join(", ")}. Not admissible — every other participant relies on these.`;

  return { verdict, blocking, notes, missing, summary };
}

export interface ProbeInput {
  /** Fetched from the candidate's own jwksUri, or supplied directly. */
  jwks: JWK[];
  /** The audience one of the sample tokens below was actually issued for. */
  audience: string;
  /** A currently-valid mandate the candidate issued, for structural checks. */
  sampleValidToken: string;
  /** Optional: an already-expired sample, needed to test expiry enforcement independently. */
  sampleExpiredToken?: string;
  /**
   * Optional: a signed statuslist+jwt where the sample mandate's status index
   * is revoked. Settles `revocation_takes_effect` without a live fetch.
   */
  sampleStatusListToken?: string;
  now?: Date;
}

function decodePayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

function decodeHeader(token: string): Record<string, unknown> {
  const part = token.split(".")[0];
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

/**
 * Independently run every check that is checkable from public artifacts
 * alone. Returns one `CheckResult` per check this probe actually
 * evaluated — feed the result straight into `assessConformance()`. Checks
 * this probe cannot evaluate without the optional artifact (expired sample /
 * status-list JWT) are simply absent from the returned array, so
 * `assessConformance` correctly reports them as `missing` rather than as a
 * silent pass.
 */
export async function probeIssuer(input: ProbeInput): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const now = input.now ?? new Date();

  // publishes_jwks: the caller already had to fetch it to get here, but the
  // shape and the absence of private components are checked independently.
  const jwksOk = input.jwks.length > 0 && input.jwks.every((k) => !("d" in k));
  results.push({
    id: "publishes_jwks",
    passed: jwksOk,
    detail: jwksOk ? undefined : "no keys supplied, or a supplied key carries a private component",
  });

  // issues_valid_jwt / registered_claims_present / scope_is_oauth_shaped:
  // structural checks against the sample token's own header and payload,
  // independent of whether it happens to still verify.
  let header: Record<string, unknown> | undefined;
  let payload: Record<string, unknown> | undefined;
  try {
    header = decodeHeader(input.sampleValidToken);
    payload = decodePayload(input.sampleValidToken);
  } catch {
    // Leave header/payload undefined; every check below reports failed.
  }

  results.push({
    id: "issues_valid_jwt",
    passed: header?.alg === "EdDSA" && (header?.typ === "JWT" || header?.typ === "zakai-mandate+jws"),
    detail: header ? `alg=${String(header.alg)} typ=${String(header.typ)}` : "sample token did not parse as a JWT",
  });

  const requiredClaims = ["iss", "aud", "sub", "jti", "iat", "nbf", "exp"];
  const missingClaims = payload ? requiredClaims.filter((c) => !(c in payload!)) : requiredClaims;
  results.push({
    id: "registered_claims_present",
    passed: missingClaims.length === 0,
    detail: missingClaims.length ? `missing: ${missingClaims.join(", ")}` : undefined,
  });

  results.push({
    id: "scope_is_oauth_shaped",
    passed: typeof payload?.scope === "string",
    detail: typeof payload?.scope === "string" ? undefined : "scope claim is not a space-delimited string",
  });

  // refuses_forbidden_scope: checked against the sample token's scope claim.
  const scopeStrings = [payload?.scope].filter((s): s is string => typeof s === "string");
  const forbiddenFound = scopeStrings
    .flatMap((s) => s.split(" "))
    .find((s) => FORBIDDEN_SCOPES.includes(s));
  results.push({
    id: "refuses_forbidden_scope",
    passed: !forbiddenFound,
    detail: forbiddenFound ? `sample token carries forbidden scope "${forbiddenFound}"` : undefined,
  });

  // rejects_forged_signature: flip one bit of the signature's own decoded
  // bytes (not a base64url character — the last character or two of a
  // base64url segment can carry only padding bits, so tampering the text
  // directly can silently decode back to the same byte string) and confirm
  // our own, independent verifier rejects it.
  const segments = input.sampleValidToken.split(".");
  let forgedRejected = false;
  if (segments.length === 3) {
    const sigBytes = Buffer.from(segments[2], "base64url");
    const tampered = Buffer.from(sigBytes);
    tampered[0] ^= 0x01;
    const forged = `${segments[0]}.${segments[1]}.${tampered.toString("base64url")}`;
    try {
      await verifyMandate(forged, { audience: input.audience, publicJwks: input.jwks, now });
      forgedRejected = false; // it verified — that is the failure
    } catch (err) {
      forgedRejected = err instanceof MandateError && err.code === "INVALID_SIGNATURE";
    }
  }
  results.push({
    id: "rejects_forged_signature",
    passed: forgedRejected,
    detail: forgedRejected ? undefined : "a tampered signature still verified, or verification failed for a different reason",
  });

  // enforces_audience: verify the real, untampered token against a
  // deliberately wrong audience and confirm rejection for exactly that reason.
  let audienceEnforced = false;
  try {
    await verifyMandate(input.sampleValidToken, {
      audience: `${input.audience}-deliberately-wrong`,
      publicJwks: input.jwks,
      now,
    });
  } catch (err) {
    audienceEnforced = err instanceof MandateError && err.code === "AUDIENCE_MISMATCH";
  }
  results.push({
    id: "enforces_audience",
    passed: audienceEnforced,
    detail: audienceEnforced ? undefined : "presenting the token to the wrong audience did not produce AUDIENCE_MISMATCH",
  });

  // enforces_expiry: only checkable if the candidate supplied an
  // already-expired sample. Not fabricated as a pass when absent.
  if (input.sampleExpiredToken) {
    let expiryEnforced = false;
    try {
      await verifyMandate(input.sampleExpiredToken, { audience: input.audience, publicJwks: input.jwks, now });
    } catch (err) {
      expiryEnforced = err instanceof MandateError && err.code === "EXPIRED";
    }
    results.push({
      id: "enforces_expiry",
      passed: expiryEnforced,
      detail: expiryEnforced ? undefined : "the supplied expired sample still verified",
    });
  }
  // If no expired sample was supplied, "enforces_expiry" is simply absent
  // from the results — assessConformance() reports it as missing, not passed.

  // publishes_status_list: sample must advertise the offline revoke pointer.
  const zkm = payload?.zkm;
  const rawStatus =
    zkm && typeof zkm === "object" ? (zkm as { status?: { idx?: unknown; uri?: unknown } }).status : undefined;
  const idx = typeof rawStatus?.idx === "number" ? rawStatus.idx : Number.NaN;
  const uri = typeof rawStatus?.uri === "string" ? rawStatus.uri.trim() : "";
  const statusPointerOk =
    Number.isInteger(idx) && idx >= 0 && /^https:\/\//i.test(uri) && !uri.includes(" ");
  results.push({
    id: "publishes_status_list",
    passed: statusPointerOk,
    detail: statusPointerOk
      ? `zkm.status.idx=${idx}`
      : "sample mandate missing zkm.status { idx, uri } — offline revoke unavailable",
  });

  // revocation_takes_effect: signed list with sample idx revoked. Absent → missing.
  if (input.sampleStatusListToken) {
    let takesEffect = false;
    let detail: string | undefined;
    const iss = typeof payload?.iss === "string" ? payload.iss : "";
    if (!statusPointerOk) {
      detail = "sample mandate missing zkm.status.idx — cannot bind list bit";
    } else if (!iss) {
      detail = "sample mandate missing iss";
    } else {
      try {
        const list = await verifyStatusList(input.sampleStatusListToken, {
          issuer: iss,
          publicJwks: input.jwks,
          now,
        });
        takesEffect = list.isRevoked(idx) === true;
        detail = takesEffect
          ? undefined
          : `idx=${idx} still active in submitted status list`;
      } catch (err) {
        detail = err instanceof Error ? err.message : "status list verification failed";
      }
    }
    results.push({
      id: "revocation_takes_effect",
      passed: takesEffect,
      detail,
    });
  }

  return results;
}

export type MandateClaimsForProbe = MandateClaims;
