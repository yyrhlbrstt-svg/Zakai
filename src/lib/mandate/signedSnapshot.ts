import "server-only";
import { SignJWT, compactVerify, decodeProtectedHeader, importJWK } from "jose";
import { loadSigningKeyFromEnv, type SigningKey } from "./mandate";

/**
 * Make the public aggregate citable, not merely published.
 *
 * WHAT WAS MISSING
 *
 * The regulatory snapshot reports real numbers — how many claims, how often
 * counterparties paid, how long they took — and reports them as a web page. A
 * regulator, a journalist or the company being described has no way to tell it
 * from marketing. They cannot check that the figures were not adjusted, that
 * the page was not edited after being quoted, or that what they are reading is
 * what was published on the date they are citing.
 *
 * So the most consequential artifact in the product was the one thing nobody
 * could verify. Every other claim here — authority, outcome, track record —
 * is signed. This was not.
 *
 * Signing it changes what it is. A quoted figure becomes checkable against a
 * published key by whoever is relying on it, and stays checkable after we
 * would have any interest in it saying something else. That is the difference
 * between a page that asserts and evidence that holds.
 *
 * WHAT IT REFUSES TO SIGN
 *
 * An empty snapshot. Signing zeros produces an authoritative-looking document
 * that says nothing, and the first use of it would be to imply a rigour the
 * data has not earned — the exact failure the existing snapshot already warns
 * about in prose when its aggregates are empty. A signature would turn that
 * warning into a formality.
 *
 * It also carries the sample size in the signed payload. A rate without an N
 * is not a statistic, and separating them lets a reader quote the rate while
 * omitting how thin it is.
 */

export const SNAPSHOT_TYPE = "zakai-snapshot+jwt";
export const SNAPSHOT_VERSION = 1;

/**
 * A snapshot describes a moment. Six months on, quoting it as current would
 * misrepresent it, so it expires rather than ageing silently into a claim
 * about today.
 */
export const SNAPSHOT_TTL_SECONDS = 60 * 60 * 24 * 180;

/** Below this the aggregate is not publishable, signed or otherwise. */
export const SNAPSHOT_MIN_SAMPLE = 5;

export interface SnapshotFacts {
  /** ISO-3166 alpha-2 market the figures cover. */
  market: string;
  /** Total documented outcomes behind every figure here. */
  sampleSize: number;
  /** Counterparties covered, so a reader knows the breadth. */
  counterparties: number;
  /** Outcomes where the counterparty paid. */
  paidCount: number;
  /** Total recovered across the sample, in minor units. */
  recoveredMinor: number;
  /** Median days from delivery to resolution among paid outcomes. */
  medianDays: number | null;
  /** Period covered, ISO dates. */
  from: string;
  to: string;
}

export interface SnapshotClaims extends SnapshotFacts {
  v: number;
  iss: string;
  iat: number;
  exp: number;
}

export class SnapshotError extends Error {
  constructor(
    message: string,
    readonly code: "TOO_THIN" | "MALFORMED" | "WRONG_TYPE" | "BAD_SIGNATURE" | "EXPIRED",
  ) {
    super(message);
    this.name = "SnapshotError";
  }
}

function assertPublishable(f: SnapshotFacts): void {
  if (!/^[A-Z]{2}$/.test(f.market)) {
    throw new SnapshotError("market must be ISO-3166 alpha-2", "MALFORMED");
  }
  for (const [name, n] of [
    ["sampleSize", f.sampleSize],
    ["counterparties", f.counterparties],
    ["paidCount", f.paidCount],
    ["recoveredMinor", f.recoveredMinor],
  ] as const) {
    if (!Number.isInteger(n) || n < 0) {
      throw new SnapshotError(`${name} must be a non-negative integer`, "MALFORMED");
    }
  }
  // Paying more often than there were outcomes is not a thin sample, it is a
  // broken one, and signing it would put a contradiction into evidence.
  if (f.paidCount > f.sampleSize) {
    throw new SnapshotError("paidCount cannot exceed sampleSize", "MALFORMED");
  }
  if (f.sampleSize < SNAPSHOT_MIN_SAMPLE) {
    throw new SnapshotError(
      `sample of ${f.sampleSize} is below the publishable minimum of ${SNAPSHOT_MIN_SAMPLE}`,
      "TOO_THIN",
    );
  }
}

export async function signSnapshot(
  facts: SnapshotFacts,
  issuer: string,
  key: SigningKey = loadSigningKeyFromEnv(),
  now: Date = new Date(),
): Promise<string> {
  assertPublishable(facts);
  const iat = Math.floor(now.getTime() / 1000);

  return new SignJWT({
    v: SNAPSHOT_VERSION,
    iss: issuer,
    iat,
    exp: iat + SNAPSHOT_TTL_SECONDS,
    ...facts,
  })
    .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: SNAPSHOT_TYPE })
    .sign(await importJWK(key.privateJwk, "EdDSA"));
}

export async function verifySnapshot(
  jws: string,
  publicJwk: Parameters<typeof importJWK>[0],
  now: Date = new Date(),
): Promise<SnapshotClaims> {
  let typ: string | undefined;
  try {
    typ = decodeProtectedHeader(jws).typ;
  } catch {
    throw new SnapshotError("not a compact JWS", "MALFORMED");
  }
  // Type before signature: a valid settlement presented as a snapshot must be
  // refused for being the wrong kind of object, not accepted because its
  // signature checks out.
  if (typ !== SNAPSHOT_TYPE) {
    throw new SnapshotError(`expected typ="${SNAPSHOT_TYPE}", got "${typ}"`, "WRONG_TYPE");
  }

  let payload: SnapshotClaims;
  try {
    const { payload: raw } = await compactVerify(jws, await importJWK(publicJwk, "EdDSA"));
    payload = JSON.parse(new TextDecoder().decode(raw)) as SnapshotClaims;
  } catch {
    throw new SnapshotError("signature did not verify", "BAD_SIGNATURE");
  }

  if (payload.exp && payload.exp < Math.floor(now.getTime() / 1000)) {
    // Expiry matters here more than elsewhere: quoting a six-month-old
    // snapshot as current would misrepresent it, and the reader should be
    // told rather than left to check a date.
    throw new SnapshotError("snapshot expired", "EXPIRED");
  }
  return payload;
}
