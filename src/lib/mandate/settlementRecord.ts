import "server-only";
import { SignJWT, compactVerify, decodeProtectedHeader, importJWK } from "jose";
import { loadSigningKeyFromEnv, type SigningKey } from "./mandate";

/**
 * A signed statement of what was actually settled — the half that was missing.
 *
 * WHAT THIS CHANGES
 *
 * The Mandate is cryptographically verifiable: anyone, forever, without
 * trusting Zakai, can check that a person authorised something. The outcome
 * was not. `SavingsProof` is a row in a private database that only Zakai
 * asserts, and nobody outside can independently confirm.
 *
 * So there was a proof of AUTHORITY and no proof of RESULT — and the result is
 * the half every party actually needs. The person needs portable evidence of
 * what they were owed and what came back. The counterparty needs evidence it
 * resolved the matter. A bank needs it as a regulatory answer. A regulator
 * needs it to measure conduct without surveying anyone. None of them can rely
 * on a row in one company's database.
 *
 * That gap is the difference between an app and a record layer. This closes
 * it: a settlement becomes a signed object the holder keeps, any party can
 * verify against the published JWKS, and no single party — including Zakai —
 * can rewrite after the fact without breaking the signature.
 *
 * DELIBERATELY NOT A MANDATE
 *
 * It carries no scope, no audience, and no authority to act. It is a statement
 * about the past, not a grant for the future, and it has its own `typ` so a
 * verifier can never mistake one for the other. Same key, same trust anchor,
 * different meaning — exactly the split trackRecordCredential.ts already makes.
 *
 * WHAT IT MUST NOT CONTAIN
 *
 * No name, no email, no phone, no case id. A record meant to be handed to a
 * counterparty, a regulator or a journalist must not carry the person around
 * with it. What makes it checkable is the signature and the counterparty, not
 * the identity of the claimant — and a self-reported figure is marked as such
 * rather than being dressed up as documented.
 */

export const SETTLEMENT_TYPE = "zakai-settlement+jwt";
export const SETTLEMENT_CLAIM_NS = "zks";
export const SETTLEMENT_VERSION = 1;

/** Long-lived: this is evidence about the past, not a permission that expires. */
export const SETTLEMENT_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

export type SettlementOutcome = "saved" | "no_saving";

export interface SettlementFacts {
  /** Normalised counterparty key — never free text. */
  counterparty: string;
  /** ISO-3166 alpha-2 market the claim was made under. */
  market: string;
  /** Rule-pack key the claim was made under. */
  vertical: string;
  outcome: SettlementOutcome;
  /** Amount charged before, in minor units. */
  beforeMinor: number;
  /** Amount charged after, in minor units. */
  afterMinor: number;
  /** Days from delivery to resolution. */
  days: number;
  /**
   * True when the person told us the result rather than the pipeline
   * documenting it from a reply. Carried in the signed payload so a reader
   * can weigh it — hiding it would make the strong and weak evidence
   * indistinguishable, which is how a corpus of proof gets quietly poisoned.
   */
  selfReported: boolean;
}

export interface SettlementClaims extends SettlementFacts {
  v: number;
  iss: string;
  iat: number;
  exp: number;
  /** Recovered per month, in minor units. Derived, never supplied. */
  recoveredMinor: number;
}

export class SettlementVerifyError extends Error {
  constructor(
    message: string,
    readonly code: "WRONG_TYPE" | "BAD_SIGNATURE" | "MALFORMED" | "EXPIRED",
  ) {
    super(message);
    this.name = "SettlementVerifyError";
  }
}

function assertFacts(f: SettlementFacts): void {
  if (!f.counterparty.trim()) throw new SettlementVerifyError("counterparty required", "MALFORMED");
  if (!/^[A-Z]{2}$/.test(f.market)) throw new SettlementVerifyError("market must be ISO-3166 alpha-2", "MALFORMED");
  if (!f.vertical.trim()) throw new SettlementVerifyError("vertical required", "MALFORMED");
  for (const [name, n] of [["beforeMinor", f.beforeMinor], ["afterMinor", f.afterMinor], ["days", f.days]] as const) {
    if (!Number.isInteger(n) || n < 0) {
      throw new SettlementVerifyError(`${name} must be a non-negative integer`, "MALFORMED");
    }
  }
  // A "saved" record whose after is not below its before is not a saving, and
  // signing it would put a contradiction into evidence somebody else relies on.
  if (f.outcome === "saved" && f.afterMinor >= f.beforeMinor) {
    throw new SettlementVerifyError("a saved settlement must reduce the amount", "MALFORMED");
  }
}

export async function signSettlement(
  facts: SettlementFacts,
  issuer: string,
  key: SigningKey = loadSigningKeyFromEnv(),
  now: Date = new Date(),
): Promise<string> {
  assertFacts(facts);
  const iat = Math.floor(now.getTime() / 1000);

  return new SignJWT({
    v: SETTLEMENT_VERSION,
    iss: issuer,
    iat,
    exp: iat + SETTLEMENT_TTL_SECONDS,
    ...facts,
    // Derived here so the signed number cannot disagree with the amounts it
    // is supposed to follow from.
    recoveredMinor: Math.max(0, facts.beforeMinor - facts.afterMinor),
    [SETTLEMENT_CLAIM_NS]: { kind: "settlement" },
  })
    .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: SETTLEMENT_TYPE })
    .sign(await importJWK(key.privateJwk, "EdDSA"));
}

/**
 * Verify a settlement against a public JWK. Throws rather than returning a
 * boolean, so a caller cannot accidentally treat a failure as a pass.
 */
export async function verifySettlement(
  jws: string,
  publicJwk: Parameters<typeof importJWK>[0],
  now: Date = new Date(),
): Promise<SettlementClaims> {
  let typ: string | undefined;
  try {
    typ = decodeProtectedHeader(jws).typ;
  } catch {
    throw new SettlementVerifyError("not a compact JWS", "MALFORMED");
  }
  // Checked before the signature: a valid Mandate presented as a settlement
  // must be refused for being the wrong kind of object, not accepted because
  // its signature happens to check out.
  if (typ !== SETTLEMENT_TYPE) {
    throw new SettlementVerifyError(`expected typ="${SETTLEMENT_TYPE}", got "${typ}"`, "WRONG_TYPE");
  }

  let payload: SettlementClaims;
  try {
    const { payload: raw } = await compactVerify(jws, await importJWK(publicJwk, "EdDSA"));
    payload = JSON.parse(new TextDecoder().decode(raw)) as SettlementClaims;
  } catch {
    throw new SettlementVerifyError("signature did not verify", "BAD_SIGNATURE");
  }

  if (payload.exp && payload.exp < Math.floor(now.getTime() / 1000)) {
    throw new SettlementVerifyError("settlement expired", "EXPIRED");
  }
  return payload;
}
