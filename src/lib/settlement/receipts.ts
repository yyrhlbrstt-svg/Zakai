/**
 * Signing the records, so a dispute does not come down to whose logs they are.
 *
 * WHY EACH PARTY SIGNS ITS OWN STATEMENT
 *
 * The settlement chain is only worth something if no participant can write
 * another participant's part of it. The principal's authority is signed by the
 * mandate issuer; the permission is signed by the institution that granted it;
 * what actually happened is signed by whoever is asserting it. Nobody signs on
 * anybody else's behalf, and no central party — including this one — can
 * fabricate a link.
 *
 * That is what makes an adjudication checkable by an outsider months later,
 * which is the only version of this that a regulator or a court finds useful.
 *
 * THE FORMAT IS A JWT AGAIN, ON PURPOSE
 *
 * A settlement receipt is an ordinary JWT with a namespaced claim, exactly like
 * a mandate. Same algorithm, same key distribution, same libraries, same
 * verification path an institution has already integrated once. A settlement
 * format that arrives with its own toolchain is one that gets deferred to next
 * quarter forever — and the cost of that decision is not aesthetic, it is
 * whether the second layer ever exists at all.
 */

import { SignJWT, importJWK, jwtVerify, type JWK } from "jose";
import type { DecisionRecord, OutcomeRecord } from "./records";
import { hashRecord } from "./records";
import { MandateError, type SigningKey } from "../mandate/mandate";

export const RECEIPT_TYPE = "JWT";
export const RECEIPT_CLAIM_NS = "zks";
export const RECEIPT_VERSION = 1;

export type ReceiptKind = "decision" | "outcome";

export interface SignedReceipt {
  kind: ReceiptKind;
  /** The signer, and the party the record is attributed to. */
  issuer: string;
  /** Hash of the record as signed. What the next link in the chain points at. */
  hash: string;
  jws: string;
}

/**
 * Sign a decision or an outcome.
 *
 * The record is embedded verbatim under a namespaced claim rather than being
 * spread across registered ones, so the bytes that were hashed and the bytes
 * that were signed are the same bytes. Flattening a record into JWT claims and
 * reconstructing it on the other side is how two implementations end up
 * hashing different objects and blaming each other's crypto.
 */
export async function signReceipt(
  kind: ReceiptKind,
  record: DecisionRecord | OutcomeRecord,
  key: SigningKey,
): Promise<SignedReceipt> {
  if (!record.institution?.trim()) {
    throw new MandateError("receipt requires an institution", "MALFORMED");
  }
  if (!record.id?.trim()) throw new MandateError("receipt requires an id", "MALFORMED");

  const hash = hashRecord(record);
  const privateKey = await importJWK(key.privateJwk, "EdDSA");
  const jws = await new SignJWT({
    [RECEIPT_CLAIM_NS]: { v: RECEIPT_VERSION, kind, record, hash },
  })
    .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: RECEIPT_TYPE })
    .setIssuer(record.institution)
    .setSubject(record.id)
    .setIssuedAt(record.at)
    .sign(privateKey);

  return { kind, issuer: record.institution, hash, jws };
}

export interface VerifiedReceipt<T> {
  kind: ReceiptKind;
  issuer: string;
  record: T;
  hash: string;
}

export interface VerifyReceiptOptions {
  /**
   * Keys belonging to `issuer`, and to nobody else. Resolve them from the
   * trust registry entry for that identity — not from the receipt, which is
   * the document under suspicion.
   */
  publicJwks: readonly JWK[];
  /**
   * Who the caller believes signed this. Required, and not optional by
   * oversight: the first version of this function checked only that the JWT's
   * `iss` matched the record's own author field, which any signer controls
   * both halves of. It therefore proved nothing, and a test that signed a
   * record naming a third party with its own key passed. Identity comes from
   * which key verified, and only the caller knows whose key it handed in.
   */
  issuer: string;
}

/**
 * Verify a receipt against the named signer's published keys.
 *
 * Deliberately takes no audience. A mandate is addressed to one institution; a
 * receipt is a statement about the world that anybody may need to check — the
 * consumer, the other party, a regulator, a court. Binding it to an audience
 * would make the record useless to precisely the people a settlement layer
 * exists to serve.
 *
 * The embedded hash is recomputed rather than trusted. A receipt whose claimed
 * hash does not match its own record is rejected outright: it is either a bug
 * in the signer or an attempt to make one document point at two different
 * chains, and there is no reading of it worth accepting.
 */
export async function verifyReceipt<T extends DecisionRecord | OutcomeRecord>(
  jws: string,
  options: VerifyReceiptOptions,
): Promise<VerifiedReceipt<T>> {
  const { publicJwks, issuer: expectedIssuer } = options;
  if (!expectedIssuer?.trim()) {
    throw new MandateError("verifyReceipt requires the expected issuer", "MALFORMED");
  }
  let payload: Record<string, unknown> | undefined;

  for (const jwk of publicJwks) {
    try {
      const key = await importJWK(jwk, "EdDSA");
      // The issuer is asserted by the caller and checked by the library, so a
      // key that verifies a receipt naming somebody else is still a failure.
      const result = await jwtVerify(jws, key, { issuer: expectedIssuer });
      payload = result.payload as Record<string, unknown>;
      break;
    } catch {
      // Try the next key. A JWKS legitimately holds several during rotation,
      // and failing on the first is how a rotation takes an integration down.
    }
  }

  if (!payload) throw new MandateError("receipt signature did not verify", "INVALID_SIGNATURE");

  const claim = payload[RECEIPT_CLAIM_NS] as
    | { v?: number; kind?: ReceiptKind; record?: T; hash?: string }
    | undefined;

  if (!claim?.record || !claim.kind) {
    throw new MandateError("receipt is missing its record", "MALFORMED");
  }
  if (claim.v !== RECEIPT_VERSION) {
    throw new MandateError(`unsupported receipt version: ${claim.v}`, "MALFORMED");
  }

  const recomputed = hashRecord(claim.record);
  if (claim.hash !== recomputed) {
    throw new MandateError("receipt hash does not match its record", "MALFORMED");
  }

  // The verified signer and the record's own author field must agree. The
  // signature check above already established that a key belonging to
  // `expectedIssuer` signed this, so a record naming a different author is a
  // statement one party has attributed to another.
  if (claim.record.institution !== expectedIssuer) {
    throw new MandateError("receipt signer does not match the record's author", "MALFORMED");
  }

  return { kind: claim.kind, issuer: String(payload.iss), record: claim.record, hash: recomputed };
}
