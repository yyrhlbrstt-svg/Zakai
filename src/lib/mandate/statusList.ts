/**
 * Revocation that works when we are down.
 *
 * THE FLAW THIS FIXES
 *
 * `/api/mandate/status/[jti]` answers "is this one revoked" — one lookup per
 * mandate, live, against our servers. That is the availability dependency a
 * bank's risk team rejects, and rightly: it means every action their customer
 * takes through an agent stops working when a startup has an outage. It also
 * leaks a query pattern — we learn which institution checked which mandate and
 * when, which is a surveillance capability nobody asked us to have.
 *
 * A Status List fixes both. It is one signed, compressed bitstring covering
 * every mandate we have ever issued. An institution fetches it every few
 * minutes, verifies our signature once, and from then on answers "is this
 * revoked" **offline, in a single bit lookup**, at any volume, forever — even
 * if we never come back.
 *
 * This is how certificate revocation was eventually solved, and it is the same
 * reason: correctness comes from the signature, recency comes from a artefact
 * you already hold. Nothing about the hot path depends on the issuer being
 * reachable.
 *
 * WHY THIS SHAPE AND NOT OUR OWN
 *
 * The layout follows the IETF Token Status List draft: a `status.status_list`
 * claim on the token carrying `{idx, uri}`, and a list served as a signed JWT
 * with a zlib-compressed bitstring. Adopting the emerging standard rather than
 * inventing a Zakai-shaped one means an institution that has implemented status
 * lists for anything else — EU digital identity wallets are being built on this
 * right now — already has the client code. Being early to somebody else's
 * standard is worth far more than being the author of our own.
 */

import { gzipSync, gunzipSync } from "node:zlib";
import { SignJWT, compactVerify, importJWK, type JWK } from "jose";
import type { SigningKey } from "./mandate";

/** Media type from the Token Status List draft. */
export const STATUS_LIST_TYPE = "statuslist+jwt";

/** One bit per mandate: 0 = valid, 1 = revoked. */
export const BITS_PER_STATUS = 1;

export class StatusListError extends Error {}

export interface StatusListClaims {
  /** Issuer — must match the mandate's `iss` for the list to apply to it. */
  iss: string;
  iat: number;
  /** When a cached copy must be refreshed. */
  exp: number;
  status_list: {
    bits: number;
    /** base64url of the gzipped bitstring. */
    lst: string;
  };
}

/**
 * Pack revoked indices into a compressed bitstring.
 *
 * Size is what makes this viable: ten million mandates is a 1.25 MB bitstring
 * that gzips to a few kilobytes when revocations are sparse, which they always
 * are. The same information as an explicit list of revoked ids, at a fraction
 * of the bytes and — more importantly — in constant time to query.
 */
export function packStatusList(revokedIndices: readonly number[], size: number): string {
  if (size < 0) throw new StatusListError("size must not be negative");
  const bytes = new Uint8Array(Math.ceil(Math.max(size, 1) / 8));
  for (const idx of revokedIndices) {
    if (!Number.isInteger(idx) || idx < 0) {
      throw new StatusListError(`invalid status index ${idx}`);
    }
    // Out-of-range indices are dropped rather than throwing: a list that
    // refuses to build because one row is malformed means nobody can check
    // revocation at all, which is strictly worse than one uncovered mandate.
    if (idx >= size) continue;
    bytes[idx >> 3] |= 1 << (idx & 7);
  }
  return Buffer.from(gzipSync(Buffer.from(bytes))).toString("base64url");
}

/** Read one status out of a packed list. Unknown indices read as valid. */
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
  return (bytes[byte] & (1 << (index & 7))) !== 0;
}

/** Sign a status list. Same envelope as a mandate, for the same reason. */
export async function signStatusList(
  input: { issuer: string; revokedIndices: readonly number[]; size: number; ttlSeconds: number; now?: Date },
  key: SigningKey,
): Promise<string> {
  const nowSec = Math.floor((input.now?.getTime() ?? Date.now()) / 1000);
  return new SignJWT({
    status_list: { bits: BITS_PER_STATUS, lst: packStatusList(input.revokedIndices, input.size) },
  })
    .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: STATUS_LIST_TYPE })
    .setIssuer(input.issuer)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + input.ttlSeconds)
    .sign(await importJWK(key.privateJwk, "EdDSA"));
}

export interface VerifiedStatusList {
  claims: StatusListClaims;
  /** Is the mandate at this index revoked? */
  isRevoked(index: number): boolean;
}

/**
 * Verify a status list and get an offline revocation oracle.
 *
 * A stale list is refused rather than used. The whole promise of this design is
 * that a cached copy answers correctly; a copy past its expiry cannot make that
 * promise, and silently serving stale revocation data is how a revoked mandate
 * keeps working — the exact failure this exists to prevent.
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

  // A list signed by one issuer says nothing about another issuer's mandates.
  // Without this check a valid list from anyone in the registry could be used
  // to assert that somebody else's revoked mandate is still live.
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
