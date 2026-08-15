import { describe, expect, it, afterAll } from "vitest";
import { compactVerify, exportJWK, generateKeyPair, importJWK, type JWK } from "jose";
import { prisma } from "@/lib/prisma";
import { loadSnapshotFacts } from "./snapshotFacts";
import { signSnapshot, verifySnapshot, SNAPSHOT_TYPE } from "@/lib/mandate/signedSnapshot";
import type { SigningKey } from "@/lib/mandate/mandate";

/**
 * The claim this makes is bigger than a unit test can check: that a figure
 * published on our own site can be verified by somebody who has only the
 * public key and no access to us. That has to be exercised against the real
 * table, with the real query, or it is an assertion about mocks.
 *
 * Requires a live database; skipped without DATABASE_URL, like the other
 * integration suites.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

/** A market code no pack registers, so this can never disturb real aggregates. */
const MARKET = "ZZ";

async function seed(rows: readonly [string, boolean, number, number, boolean][]) {
  for (const [counterparty, paid, recoveredMinor, days, selfReported] of rows) {
    await prisma.strategyOutcome.create({
      data: {
        market: MARKET,
        vertical: "telecom",
        counterparty,
        variantId: "v1",
        paid,
        recoveredMinor,
        days,
        selfReported,
      },
    });
  }
}

async function keys(): Promise<{ key: SigningKey; publicJwk: JWK }> {
  const { privateKey, publicKey } = await generateKeyPair("Ed25519", { extractable: true });
  return {
    key: { kid: "integration-key", privateJwk: await exportJWK(privateKey) },
    publicJwk: await exportJWK(publicKey),
  };
}

afterAll(async () => {
  if (hasDb) await prisma.strategyOutcome.deleteMany({ where: { market: MARKET } });
});

suite("a published aggregate can be checked by a stranger", () => {
  it("signs real rows into an object verifiable with the public key alone", async () => {
    await prisma.strategyOutcome.deleteMany({ where: { market: MARKET } });
    await seed([
      ["cellcom", true, 30_000, 6, false],
      ["partner", true, 12_500, 14, false],
      ["partner", false, 0, 0, false],
      ["hot", true, 8_000, 22, false],
      ["bezeq", true, 5_500, 40, false],
      ["bezeq", false, 0, 0, false],
      // A self-report with an enormous figure: it must not reach a signed
      // market statistic, or one person's recollection becomes evidence.
      ["ghost", true, 9_999_999, 1, true],
    ]);

    const facts = await loadSnapshotFacts(MARKET);
    expect(facts).not.toBeNull();
    expect(facts!.sampleSize).toBe(6);
    expect(facts!.counterparties).toBe(4);
    expect(facts!.paidCount).toBe(4);
    expect(facts!.recoveredMinor).toBe(56_000);
    expect(facts!.medianDays).toBe(18); // paid days 6, 14, 22, 40 → (14+22)/2

    const { key, publicJwk } = await keys();
    const jws = await signSnapshot(facts!, "https://zakai.example", key);

    // Verified through our own verifier...
    const claims = await verifySnapshot(jws, publicJwk);
    expect(claims.sampleSize).toBe(6);
    expect(claims.recoveredMinor).toBe(56_000);

    // ...and independently, with nothing but jose and the published key —
    // which is the property that makes it citable rather than merely stated.
    const { payload, protectedHeader } = await compactVerify(
      jws,
      await importJWK(publicJwk, "EdDSA"),
    );
    expect(protectedHeader.typ).toBe(SNAPSHOT_TYPE);
    const read = JSON.parse(new TextDecoder().decode(payload)) as Record<string, unknown>;
    expect(read.sampleSize).toBe(6);
    expect(read.recoveredMinor).toBe(56_000);
  });

  it("refuses to produce anything for a market with no documented outcomes", async () => {
    await prisma.strategyOutcome.deleteMany({ where: { market: MARKET } });
    expect(await loadSnapshotFacts(MARKET)).toBeNull();
  });

  it("refuses a market whose only outcomes are self-reported", async () => {
    // Otherwise the thinnest possible evidence would produce the most
    // authoritative-looking artifact the product can emit.
    await prisma.strategyOutcome.deleteMany({ where: { market: MARKET } });
    await seed([
      ["a", true, 10_000, 5, true],
      ["b", true, 10_000, 5, true],
      ["c", true, 10_000, 5, true],
      ["d", true, 10_000, 5, true],
      ["e", true, 10_000, 5, true],
      ["f", true, 10_000, 5, true],
    ]);
    expect(await loadSnapshotFacts(MARKET)).toBeNull();
  });
});
