/**
 * Revocation resolution for verifier paths.
 *
 * Tokens that embed `zkm.status` are checked against the signed status list
 * only (offline / JWKS path). If the list is unreachable → unknown (deny).
 * Live `/status/{jti}` is for legacy tokens that never advertised a status
 * pointer — never as a bypass when the token claimed the offline path.
 */

import { verifyStatusListFromUrl } from "./statusList";

export type RevocationState = "active" | "revoked" | "unknown";

/** Offline bit check — fail-closed to unknown on any fetch/verify error. */
export async function statusListRevocationState(
  status: { idx: number; uri: string },
  options: { issuer: string; jwksUri: string; now?: Date },
): Promise<RevocationState> {
  try {
    const list = await verifyStatusListFromUrl({
      statusListUri: status.uri,
      issuer: options.issuer,
      jwksUri: options.jwksUri,
      now: options.now,
    });
    return list.isRevoked(status.idx) ? "revoked" : "active";
  } catch {
    return "unknown";
  }
}

/**
 * When the mandate advertises `zkm.status`, the signed list is authoritative
 * (including unknown). Live lookup only for legacy tokens without the claim.
 */
export async function resolveRevocationState(input: {
  jti: string;
  status?: { idx: number; uri: string };
  issuer: string;
  jwksUri: string;
  liveLookup: (jti: string) => Promise<RevocationState>;
  now?: Date;
}): Promise<{ state: RevocationState; via: "status_list" | "live_status" }> {
  if (input.status) {
    const listState = await statusListRevocationState(input.status, {
      issuer: input.issuer,
      jwksUri: input.jwksUri,
      now: input.now,
    });
    return { state: listState, via: "status_list" };
  }

  return { state: await input.liveLookup(input.jti), via: "live_status" };
}
