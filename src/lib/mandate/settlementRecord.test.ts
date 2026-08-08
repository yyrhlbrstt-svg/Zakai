import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, decodeJwt, type JWK } from "jose";
import {
  SETTLEMENT_TYPE,
  signSettlement,
  verifySettlement,
  type SettlementFacts,
} from "./settlementRecord";
import type { SigningKey } from "./mandate";

const ISS = "https://zakai.test";

const facts = (over: Partial<SettlementFacts> = {}): SettlementFacts => ({
  counterparty: "cellcom",
  market: "IL",
  vertical: "telecom",
  outcome: "saved",
  beforeMinor: 12_000,
  afterMinor: 7_000,
  days: 9,
  selfReported: false,
  ...over,
});

async function keys(): Promise<{ key: SigningKey; publicJwk: JWK }> {
  const { privateKey, publicKey } = await generateKeyPair("Ed25519", { extractable: true });
  return {
    key: { kid: "test-key", privateJwk: await exportJWK(privateKey) },
    publicJwk: await exportJWK(publicKey),
  };
}

describe("a settlement is independently verifiable", () => {
  /**
   * The property that turns a database row into evidence. Anyone holding the
   * published public key can confirm the facts without trusting — or even
   * contacting — Zakai.
   */
  it("verifies against the public key alone", async () => {
    const { key, publicJwk } = await keys();
    const jws = await signSettlement(facts(), ISS, key);
    const claims = await verifySettlement(jws, publicJwk);
    expect(claims.counterparty).toBe("cellcom");
    expect(claims.outcome).toBe("saved");
  });

  it("cannot be rewritten after the fact, including by us", async () => {
    const { key, publicJwk } = await keys();
    const jws = await signSettlement(facts(), ISS, key);
    const [h, p, s] = jws.split(".");
    const at = 10;
    const tampered = `${h}.${p.slice(0, at)}${p[at] === "A" ? "B" : "A"}${p.slice(at + 1)}.${s}`;
    await expect(verifySettlement(tampered, publicJwk)).rejects.toMatchObject({
      code: "BAD_SIGNATURE",
    });
  });

  it("derives the recovered amount rather than trusting a supplied one", async () => {
    // A signed number that disagreed with the amounts it follows from would be
    // a contradiction inside evidence somebody else relies on.
    const { key } = await keys();
    const jws = await signSettlement(facts({ beforeMinor: 12_000, afterMinor: 7_000 }), ISS, key);
    expect(decodeJwt(jws).recoveredMinor).toBe(5_000);
  });

  it("is refused when presented as the wrong kind of object", async () => {
    const { key, publicJwk } = await keys();
    const jws = await signSettlement(facts(), ISS, key);
    expect(await import("jose").then((j) => j.decodeProtectedHeader(jws).typ)).toBe(
      SETTLEMENT_TYPE,
    );
    // And a non-settlement JWS is rejected on type before its signature is
    // even considered.
    const other = await new (await import("jose")).SignJWT({ a: 1 })
      .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: "zakai-mandate+jwt" })
      .sign(await import("jose").then((j) => j.importJWK(key.privateJwk, "EdDSA")));
    await expect(verifySettlement(other, publicJwk)).rejects.toMatchObject({ code: "WRONG_TYPE" });
  });

  it("rejects junk instead of throwing something unhelpful", async () => {
    const { publicJwk } = await keys();
    await expect(verifySettlement("not-a-jws", publicJwk)).rejects.toMatchObject({
      code: "MALFORMED",
    });
  });
});

describe("a settlement carries no person", () => {
  /**
   * This is meant to be handed to a counterparty, a regulator, or a
   * journalist. It must not carry the claimant around with it — what makes it
   * checkable is the signature and the counterparty, not who filed it.
   */
  it("contains no identifying field", async () => {
    const { key } = await keys();
    const jws = await signSettlement(facts(), ISS, key);
    const payload = decodeJwt(jws) as Record<string, unknown>;
    for (const forbidden of ["name", "email", "phone", "sub", "caseId", "userId", "principal"]) {
      expect(payload[forbidden], `${forbidden} must not be present`).toBeUndefined();
    }
  });

  it("marks a self-reported result rather than dressing it as documented", async () => {
    // Making strong and weak evidence indistinguishable is how a corpus of
    // proof gets quietly poisoned.
    const { key } = await keys();
    const jws = await signSettlement(facts({ selfReported: true }), ISS, key);
    expect(decodeJwt(jws).selfReported).toBe(true);
  });
});

describe("a settlement cannot state a contradiction", () => {
  it("refuses a saved outcome that did not reduce the amount", async () => {
    const { key } = await keys();
    await expect(
      signSettlement(facts({ outcome: "saved", beforeMinor: 7_000, afterMinor: 7_000 }), ISS, key),
    ).rejects.toMatchObject({ code: "MALFORMED" });
  });

  it("allows a no-saving outcome with equal amounts, which is a real result", async () => {
    const { key, publicJwk } = await keys();
    const jws = await signSettlement(
      facts({ outcome: "no_saving", beforeMinor: 7_000, afterMinor: 7_000 }),
      ISS,
      key,
    );
    const claims = await verifySettlement(jws, publicJwk);
    expect(claims.recoveredMinor).toBe(0);
  });

  it("refuses malformed inputs rather than signing them", async () => {
    const { key } = await keys();
    for (const bad of [
      facts({ counterparty: "  " }),
      facts({ market: "Israel" }),
      facts({ vertical: "" }),
      facts({ beforeMinor: -1 }),
      facts({ days: 1.5 }),
    ]) {
      await expect(signSettlement(bad, ISS, key)).rejects.toMatchObject({ code: "MALFORMED" });
    }
  });
});
