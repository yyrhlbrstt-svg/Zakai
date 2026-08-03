/**
 * Revocation resolution for verifier paths.
 *
 * Tokens that embed `zkm.status` are checked against the signed status list
 * first (offline / JWKS path). Live `/status/{jti}` remains for legacy tokens
 * and as a fallback when the list cannot be fetched.
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
 * Prefer status list when the mandate advertises `zkm.status`; otherwise use
 * the provided live lookup (usually DB /status/{jti}).
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
    if (listState === "revoked" || listState === "active") {
      return { state: listState, via: "status_list" };
    }
  }

  return { state: await input.liveLookup(input.jti), via: "live_status" };
}
