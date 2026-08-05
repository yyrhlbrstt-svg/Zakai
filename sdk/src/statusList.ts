/**
 * Offline revocation via signed Status List (IETF Token Status List shape).
 * Ported from the production app — verify + bit lookup only (no signing keys
 * in the client SDK).
 */

import { gunzipSync } from "node:zlib";
import { compactVerify, importJWK, type JWK } from "jose";

export const STATUS_LIST_TYPE = "statuslist+jwt";
export const BITS_PER_STATUS = 1;

export class StatusListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatusListError";
  }
}

export interface StatusListClaims {
  iss: string;
  iat: number;
  exp: number;
  status_list: {
    bits: number;
    lst: string;
  };
}

/** Read one status out of a packed list. Unknown indices read as valid (not revoked). */
export function readStatus(lst: string, index: number): boolean {
  if (!Number.isInteger(index) || index < 0) return false;
  let bytes: Buffer;
  try {
    bytes = gunzipSync(Buffer.from(lst, "base64url"));
  } catch {
    throw new StatusListError("status list is not valid gzip");
  }
  const byte = index >> 3;
  if (byte >= bytes.length) return false;
  return (bytes[byte]! & (1 << (index & 7))) !== 0;
}

export interface VerifiedStatusList {
  claims: StatusListClaims;
  isRevoked(index: number): boolean;
}

/**
 * Verify a statuslist+jwt and get an offline revocation oracle.
 * Stale lists are refused — never silently trust expired revocation data.
 */
export async function verifyStatusList(
  token: string,
  options: { issuer: string; publicJwks: JWK[]; now?: Date; toleranceSeconds?: number },
): Promise<VerifiedStatusList> {
  let payload: Uint8Array | undefined;
  let typ: string | undefined;

  for (const jwk of options.publicJwks) {
    try {
      const result = await compactVerify(token, await importJWK(jwk, "EdDSA"));
      payload = result.payload;
      typ = result.protectedHeader.typ;
      break;
    } catch {
      // Wrong key; try the next.
    }
  }
  if (!payload) throw new StatusListError("no configured key verifies this status list");
  if (typ !== STATUS_LIST_TYPE) throw new StatusListError(`unexpected typ "${typ}"`);

  let claims: StatusListClaims;
  try {
    claims = JSON.parse(new TextDecoder().decode(payload)) as StatusListClaims;
  } catch {
    throw new StatusListError("status list payload is not valid JSON");
  }

  if (claims.iss !== options.issuer) {
    throw new StatusListError(`status list issued by "${claims.iss}", expected "${options.issuer}"`);
  }
  if (!claims.status_list?.lst) throw new StatusListError("status list is missing its bitstring");

  const nowSec = Math.floor((options.now?.getTime() ?? Date.now()) / 1000);
  if (nowSec - (options.toleranceSeconds ?? 60) >= claims.exp) {
    throw new StatusListError("status list has expired — refetch before trusting it");
  }

  return { claims, isRevoked: (index: number) => readStatus(claims.status_list.lst, index) };
}

/** Fetch + verify the issuer's published status list in one call. */
export async function verifyStatusListFromUrl(options: {
  statusListUri: string;
  issuer: string;
  jwksUri: string;
  now?: Date;
  /** When JWKS is already in hand (e.g. just used to verify the mandate). */
  publicJwks?: JWK[];
}): Promise<VerifiedStatusList> {
  const listRes = await fetch(options.statusListUri);
  if (!listRes.ok) throw new StatusListError(`status list HTTP ${listRes.status}`);
  const token = await listRes.text();

  let publicJwks = options.publicJwks;
  if (!publicJwks) {
    const jwksRes = await fetch(options.jwksUri);
    if (!jwksRes.ok) throw new StatusListError(`jwks HTTP ${jwksRes.status}`);
    const jwks = (await jwksRes.json()) as { keys?: JWK[] };
    if (!Array.isArray(jwks.keys) || jwks.keys.length === 0) {
      throw new StatusListError("jwks has no keys");
    }
    publicJwks = jwks.keys;
  }

  return verifyStatusList(token, {
    issuer: options.issuer,
    publicJwks,
    now: options.now,
  });
}

/**
 * Offline revocation answer for a mandate that embeds `zkm.status`.
 * Fail-closed: fetch/verify problems → "unknown" (never pretend active).
 */
export async function statusListRevocationState(
  status: { idx: number; uri: string },
  options: { issuer: string; jwksUri: string; now?: Date; publicJwks?: JWK[] },
): Promise<"active" | "revoked" | "unknown"> {
  try {
    const list = await verifyStatusListFromUrl({
      statusListUri: status.uri,
      issuer: options.issuer,
      jwksUri: options.jwksUri,
      now: options.now,
      publicJwks: options.publicJwks,
    });
    return list.isRevoked(status.idx) ? "revoked" : "active";
  } catch {
    return "unknown";
  }
}
