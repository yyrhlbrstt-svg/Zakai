import { describe, expect, it } from "vitest";
import { SignJWT, decodeJwt, exportJWK, generateKeyPair, importJWK, type JWK } from "jose";
import {
  SNAPSHOT_MIN_SAMPLE,
  SNAPSHOT_TTL_SECONDS,
  SNAPSHOT_TYPE,
  signSnapshot,
  verifySnapshot,
  type SnapshotFacts,
} from "./signedSnapshot";
import type { SigningKey } from "./mandate";

const ISS = "https://zakai.test";
const NOW = new Date("2026-08-08T00:00:00Z");

const facts = (over: Partial<SnapshotFacts> = {}): SnapshotFacts => ({
  market: "IL",
  sampleSize: 40,
  counterparties: 7,
  paidCount: 26,
  recoveredMinor: 1_250_000,
  medianDays: 18,
  from: "2026-02-08",
  to: "2026-08-08",
  ...over,
});

async function keys(): Promise<{ key: SigningKey; publicJwk: JWK }> {
  const { privateKey, publicKey } = await generateKeyPair("Ed25519", { extractable: true });
  return {
    key: { kid: "test-key", privateJwk: await exportJWK(privateKey) },
    publicJwk: await exportJWK(publicKey),
  };
}

describe("a published aggregate becomes citable", () => {
  /**
   * The whole point: a regulator, a journalist or the company being described
   * can check the figures against a published key, without trusting — or
   * contacting — Zakai, and can still check them later.
   */
  it("verifies against the public key alone", async () => {
    const { key, publicJwk } = await keys();
    const jws = await signSnapshot(facts(), ISS, key, NOW);
    const claims = await verifySnapshot(jws, publicJwk, NOW);
    expect(claims.market).toBe("IL");
    expect(claims.sampleSize).toBe(40);
    expect(claims.paidCount).toBe(26);
    expect(claims.iss).toBe(ISS);
  });

  it("cannot be edited after being quoted, including by us", async () => {
    const { key, publicJwk } = await keys();
    const jws = await signSnapshot(facts(), ISS, key, NOW);
    const [h, p, s] = jws.split(".");
    const at = 10;
    const tampered = `${h}.${p.slice(0, at)}${p[at] === "A" ? "B" : "A"}${p.slice(at + 1)}.${s}`;
    await expect(verifySnapshot(tampered, publicJwk, NOW)).rejects.toMatchObject({
      code: "BAD_SIGNATURE",
    });
  });

  it("rejects junk instead of throwing something unhelpful", async () => {
    const { publicJwk } = await keys();
    await expect(verifySnapshot("not-a-jws", publicJwk, NOW)).rejects.toMatchObject({
      code: "MALFORMED",
    });
  });

  /**
   * Same key, same trust anchor, different meaning. A settlement is a statement
   * about one case; a snapshot is a statement about a population. Reading one
   * as the other would misreport an individual result as market-wide evidence.
   */
  it("refuses another signed object presented as a snapshot", async () => {
    const { key, publicJwk } = await keys();
    const settlementShaped = await new SignJWT({ counterparty: "cellcom", outcome: "saved" })
      .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: "zakai-settlement+jwt" })
      .sign(await importJWK(key.privateJwk, "EdDSA"));
    await expect(verifySnapshot(settlementShaped, publicJwk, NOW)).rejects.toMatchObject({
      code: "WRONG_TYPE",
    });
  });

  it("stamps its own type so a verifier can tell what it is", async () => {
    const { key } = await keys();
    const jws = await signSnapshot(facts(), ISS, key, NOW);
    const { decodeProtectedHeader } = await import("jose");
    expect(decodeProtectedHeader(jws).typ).toBe(SNAPSHOT_TYPE);
  });
});

describe("what it refuses to sign", () => {
  /**
   * Signing zeros produces an authoritative-looking document that says
   * nothing, and the first use of it would be to imply a rigour the data has
   * not earned.
   */
  it("refuses an empty aggregate", async () => {
    const { key } = await keys();
    await expect(
      signSnapshot(facts({ sampleSize: 0, paidCount: 0, recoveredMinor: 0 }), ISS, key, NOW),
    ).rejects.toMatchObject({ code: "TOO_THIN" });
  });

  it("refuses a sample below the publishable minimum", async () => {
    const { key } = await keys();
    await expect(
      signSnapshot(facts({ sampleSize: SNAPSHOT_MIN_SAMPLE - 1, paidCount: 1 }), ISS, key, NOW),
    ).rejects.toMatchObject({ code: "TOO_THIN" });
  });

  it("signs at exactly the minimum, so the gate is a floor and not a moving target", async () => {
    const { key, publicJwk } = await keys();
    const jws = await signSnapshot(
      facts({ sampleSize: SNAPSHOT_MIN_SAMPLE, paidCount: 2 }),
      ISS,
      key,
      NOW,
    );
    expect((await verifySnapshot(jws, publicJwk, NOW)).sampleSize).toBe(SNAPSHOT_MIN_SAMPLE);
  });

  /**
   * Paying more often than there were outcomes is not a thin sample, it is a
   * broken one, and signing it would put a contradiction into evidence.
   */
  it("refuses more payments than outcomes", async () => {
    const { key } = await keys();
    await expect(
      signSnapshot(facts({ sampleSize: 10, paidCount: 11 }), ISS, key, NOW),
    ).rejects.toMatchObject({ code: "MALFORMED" });
  });

  it("refuses malformed figures rather than signing them", async () => {
    const { key } = await keys();
    for (const bad of [
      facts({ market: "Israel" }),
      facts({ market: "il" }),
      facts({ counterparties: -1 }),
      facts({ recoveredMinor: -1 }),
      facts({ recoveredMinor: 1_000.5 }),
      facts({ sampleSize: 12.5 }),
    ]) {
      await expect(signSnapshot(bad, ISS, key, NOW)).rejects.toMatchObject({ code: "MALFORMED" });
    }
  });
});

describe("the sample size travels with the rate", () => {
  /**
   * A rate without an N is not a statistic. Separating them would let a reader
   * quote "62% paid" while omitting that it rests on eight cases.
   */
  it("carries sampleSize and counterparties inside the signature", async () => {
    const { key } = await keys();
    const jws = await signSnapshot(facts({ sampleSize: 8, paidCount: 5 }), ISS, key, NOW);
    const payload = decodeJwt(jws);
    expect(payload.sampleSize).toBe(8);
    expect(payload.counterparties).toBe(7);
  });

  it("carries the period it covers", async () => {
    const { key } = await keys();
    const payload = decodeJwt(await signSnapshot(facts(), ISS, key, NOW));
    expect(payload.from).toBe("2026-02-08");
    expect(payload.to).toBe("2026-08-08");
  });

  it("allows an absent median rather than inventing one", async () => {
    // No paid outcome yet resolved means there is no median. Substituting a
    // number would fabricate the very figure a reader would rely on most.
    const { key, publicJwk } = await keys();
    const jws = await signSnapshot(facts({ medianDays: null }), ISS, key, NOW);
    expect((await verifySnapshot(jws, publicJwk, NOW)).medianDays).toBeNull();
  });
});

describe("a snapshot describes a moment, not today", () => {
  it("expires rather than ageing silently into a claim about the present", async () => {
    const { key, publicJwk } = await keys();
    const jws = await signSnapshot(facts(), ISS, key, NOW);
    const later = new Date(NOW.getTime() + (SNAPSHOT_TTL_SECONDS + 1) * 1000);
    await expect(verifySnapshot(jws, publicJwk, later)).rejects.toMatchObject({ code: "EXPIRED" });
  });

  it("is still valid the day before it expires", async () => {
    const { key, publicJwk } = await keys();
    const jws = await signSnapshot(facts(), ISS, key, NOW);
    const almost = new Date(NOW.getTime() + (SNAPSHOT_TTL_SECONDS - 86_400) * 1000);
    await expect(verifySnapshot(jws, publicJwk, almost)).resolves.toMatchObject({ market: "IL" });
  });
});

describe("a snapshot carries no person", () => {
  /**
   * It is an aggregate meant for publication. If a single claimant could be
   * read out of it, publishing it would be a disclosure rather than a
   * statistic.
   */
  it("contains no identifying field", async () => {
    const { key } = await keys();
    const payload = decodeJwt(await signSnapshot(facts(), ISS, key, NOW)) as Record<
      string,
      unknown
    >;
    for (const forbidden of ["name", "email", "phone", "sub", "caseId", "userId", "counterparty"]) {
      expect(payload[forbidden], `${forbidden} must not be present`).toBeUndefined();
    }
  });
});
