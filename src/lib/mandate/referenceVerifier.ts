/**
 * Reference verification algorithm for institutions.
 *
 * This file is intentionally readable as a specification: a bank engineer
 * should be able to reimplement it in Java, Go, or Python from the comments
 * and the steps below, using only a standard JWS library and our JWKS.
 *
 * Production institutions SHOULD implement this on their side (offline),
 * and treat POST /api/mandate/verify as a convenience — not a dependency.
 */

import {
  verifyMandate,
  type MandateClaims,
  type VerifyOptions,
} from "./mandate";

export type StatusLookup = (jti: string) => Promise<"active" | "revoked" | "unknown">;

export interface InstitutionalVerifyInput {
  token: string;
  /** Your institution id — must match the Mandate `aud` claim. */
  audience: string;
  publicJwks: VerifyOptions["publicJwks"];
  statusLookup: StatusLookup;
  toleranceSeconds?: number;
}

export type InstitutionalVerifyResult =
  | { ok: true; claims: MandateClaims; status: "active" }
  | { ok: false; reason: string; code?: string };

/**
 * Full institutional check: signature + audience + time + revocation status.
 */
export async function institutionalVerify(
  input: InstitutionalVerifyInput,
): Promise<InstitutionalVerifyResult> {
  let claims: MandateClaims;
  try {
    claims = await verifyMandate(input.token, {
      audience: input.audience,
      publicJwks: input.publicJwks,
      toleranceSeconds: input.toleranceSeconds,
    });
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "VERIFY_FAILED";
    const message = err instanceof Error ? err.message : "verification failed";
    return { ok: false, reason: message, code };
  }

  const status = await input.statusLookup(claims.jti);
  if (status === "revoked") {
    return { ok: false, reason: "mandate has been revoked", code: "REVOKED" };
  }
  if (status === "unknown") {
    // Policy choice: many institutions fail closed on unknown.
    return { ok: false, reason: "status store unavailable", code: "STATUS_UNKNOWN" };
  }

  return { ok: true, claims, status: "active" };
}

/**
 * Pseudocode for non-TypeScript stacks (document in code on purpose):
 *
 *   jwks = HTTP GET /.well-known/zakai-jwks.json   # cache 1h
 *   claims = jws.verify(token, jwks, alg=EdDSA)
 *   assert claims.typ == "zakai-mandate+jws"      # from header
 *   assert claims.aud == MY_INSTITUTION_ID
 *   assert now in [claims.nbf, claims.exp)
 *   assert no claim.scope in FORBIDDEN_SCOPES
 *   status = HTTP GET /api/mandate/status/{claims.jti}
 *   assert status.status == "active"
 *   allow only actions ⊆ claims.scopes
 */
