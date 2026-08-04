/**
 * Independent verification for the conformance suite in `conformance.ts`.
 *
 * `assessConformance()` grades a candidate's own self-reported `CheckResult[]`
 * — honest, but self-attestation is not independent verification, and a
 * registry that only ever grades what a candidate says about itself is an
 * honour system wearing a conformance programme's clothes.
 *
 * `probeIssuer` closes part of that gap. Given a candidate's public JWKS and
 * one sample mandate they issue, it runs `verifyMandate` — this codebase's own
 * reference verifier, not the candidate's code — against every check that is
 * genuinely settleable from those artifacts alone. `publishes_status_list` is
 * settled from the sample embedding `zkm.status`. Expiry needs an already-
 * expired sample; `revocation_takes_effect` still needs a post-revoke refresh
 * window and is left absent rather than assumed to pass.
 */

import type { JWK } from "jose";
import { FORBIDDEN_SCOPES } from "./scopes";
import { verifyMandate, MandateError } from "./mandate";
import type { CheckResult } from "./conformance";

export interface ProbeInput {
  /** The candidate's own published JWKS. */
  jwks: JWK[];
  /** The audience one of the sample tokens below was actually issued for. */
  audience: string;
  /** A currently-valid mandate the candidate issued, for structural checks. */
  sampleValidToken: string;
  /** Optional: an already-expired sample, needed to test expiry enforcement independently. */
  sampleExpiredToken?: string;
  now?: Date;
}

function decodeSegment(token: string, index: number): Record<string, unknown> {
  const part = token.split(".")[index];
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

/**
 * Run every check that is checkable from public artifacts alone. Returns one
 * `CheckResult` per check this probe actually evaluated — feed the result
 * straight into `assessConformance()`.
 */
export async function probeIssuer(input: ProbeInput): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const now = input.now ?? new Date();

  const jwksOk = input.jwks.length > 0 && input.jwks.every((k) => !("d" in k));
  results.push({
    id: "publishes_jwks",
    passed: jwksOk,
    detail: jwksOk ? undefined : "no keys supplied, or a supplied key carries a private component",
  });

  let header: Record<string, unknown> | undefined;
  let payload: Record<string, unknown> | undefined;
  try {
    header = decodeSegment(input.sampleValidToken, 0);
    payload = decodeSegment(input.sampleValidToken, 1);
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

  const scopeStrings = [payload?.scope].filter((s): s is string => typeof s === "string");
  const forbiddenFound = scopeStrings.flatMap((s) => s.split(" ")).find((s) => FORBIDDEN_SCOPES.includes(s));
  results.push({
    id: "refuses_forbidden_scope",
    passed: !forbiddenFound,
    detail: forbiddenFound ? `sample token carries forbidden scope "${forbiddenFound}"` : undefined,
  });

  // Flip a bit in the signature's own decoded bytes, not its base64url text —
  // the trailing character(s) of a base64url segment can carry only padding
  // bits, so tampering the text directly can silently round-trip to the same
  // byte string and leave a forged token that still verifies.
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
  // If no expired sample was supplied, "enforces_expiry" is simply absent —
  // assessConformance() reports it as missing, not passed.

  // publishes_status_list: settleable from the sample advertising zkm.status
  // (idx + https uri). Hourly refresh / propagation stays for monitoring.
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

  return results;
}
