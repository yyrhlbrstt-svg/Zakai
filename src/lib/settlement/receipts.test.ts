import { beforeAll, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, type JWK } from "jose";
import { signReceipt, verifyReceipt } from "./receipts";
import { hashRecord, type DecisionRecord } from "./records";
import { MandateError, publicJwkFor, type SigningKey } from "../mandate/mandate";
import { resolveIssuerKeysUri } from "../mandate/trustRegistry";

let bankKey: SigningKey;
let bankJwk: JWK;
let otherKey: SigningKey;
let otherJwk: JWK;

beforeAll(async () => {
  const a = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const b = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  bankKey = { kid: "bank-2026", privateJwk: await exportJWK(a.privateKey) };
  otherKey = { kid: "someone-else", privateJwk: await exportJWK(b.privateKey) };
  bankJwk = await publicJwkFor(bankKey);
  otherJwk = await publicJwkFor(otherKey);
});

const record = (over: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id: "dec_1",
  institution: "bank.example",
  mandateJti: "mnd_1",
  prevHash: "a".repeat(64),
  action: "dispute:charge",
  decision: "permit",
  at: 1_800_000_000,
  ...over,
});

describe("a signed receipt round-trips", () => {
  it("verifies against the signer's key and returns the record intact", async () => {
    const signed = await signReceipt("decision", record(), bankKey);
    const v = await verifyReceipt<DecisionRecord>(signed.jws, { publicJwks: [bankJwk], issuer: "bank.example" });
    expect(v.kind).toBe("decision");
    expect(v.issuer).toBe("bank.example");
    expect(v.record.action).toBe("dispute:charge");
    expect(v.hash).toBe(hashRecord(record()));
  });

  it("publishes a hash the next link in the chain can point at", async () => {
    const signed = await signReceipt("decision", record(), bankKey);
    expect(signed.hash).toBe(hashRecord(record()));
    expect(signed.hash).toHaveLength(64);
  });

  it("tries every key in a JWKS, so a rotation does not break verification", async () => {
    // A JWKS legitimately holds several keys during rotation. Failing on the
    // first is how a routine rotation takes an integration down.
    const signed = await signReceipt("decision", record(), bankKey);
    const v = await verifyReceipt<DecisionRecord>(signed.jws, { publicJwks: [otherJwk, bankJwk], issuer: "bank.example" });
    expect(v.issuer).toBe("bank.example");
  });
});

describe("nobody can sign somebody else's statement", () => {
  it("rejects a receipt signed by a key that is not the signer's", async () => {
    const signed = await signReceipt("decision", record(), bankKey);
    await expect(verifyReceipt(signed.jws, { publicJwks: [otherJwk], issuer: "bank.example" })).rejects.toThrow(MandateError);
  });

  it("rejects a record attributed to a party other than the signer", async () => {
    // The first version of verifyReceipt only checked that the JWT's `iss`
    // matched the record's own author field — both of which the signer writes.
    // It therefore proved nothing, and this test passed a forgery until the
    // caller was made to name whose key it was handing in.
    const signed = await signReceipt("decision", record({ institution: "bank.example" }), bankKey);
    const forged = await signReceipt(
      "decision",
      record({ institution: "victim.example" }),
      bankKey,
    );
    await expect(
      verifyReceipt(signed.jws, { publicJwks: [bankJwk], issuer: "bank.example" }),
    ).resolves.toBeDefined();
    // Checked as the bank's key: the record names somebody else, so it fails.
    await expect(
      verifyReceipt(forged.jws, { publicJwks: [bankJwk], issuer: "bank.example" }),
    ).rejects.toThrow(MandateError);
    // Checked properly as the victim — against the victim's own key, which is
    // what a caller resolving from the trust registry would hand in — the
    // signature is not theirs and it fails. `otherJwk` stands in for the
    // victim's real key here.
    await expect(
      verifyReceipt(forged.jws, { publicJwks: [otherJwk], issuer: "victim.example" }),
    ).rejects.toThrow(MandateError);
  });

  it("has one place to resolve a party's keys from, so the safe path is the easy one", () => {
    // The one property this file cannot provide for itself, and the one an
    // integrator will assume it does: a caller who resolves the bank's JWKS and
    // then claims to be checking the victim has told the verifier a falsehood
    // about the world, and it will believe them. Key-to-identity binding lives
    // in the registry, and an unregistered party has no key location at all —
    // which is the correct answer, not an error to route around.
    expect(resolveIssuerKeysUri("https://zakai-3uxj.vercel.app")).toMatch(/^https:\/\//);
    expect(resolveIssuerKeysUri("https://victim.example")).toBeNull();
  });

  it("refuses to verify without being told whose key it is", async () => {
    // Identity comes from which key verified, and only the caller knows that.
    // Making the parameter optional would restore the hole it was added to close.
    const signed = await signReceipt("decision", record(), bankKey);
    await expect(
      verifyReceipt(signed.jws, { publicJwks: [bankJwk], issuer: "  " }),
    ).rejects.toThrow(MandateError);
  });

  it("rejects an unsigned or malformed token outright", async () => {
    for (const bad of ["", "not-a-jwt", "a.b.c"]) {
      await expect(verifyReceipt(bad, { publicJwks: [bankJwk], issuer: "bank.example" })).rejects.toThrow(MandateError);
    }
  });
});

describe("the embedded hash is recomputed, never trusted", () => {
  it("rejects a receipt whose claimed hash does not match its record", async () => {
    // Either a bug in the signer, or an attempt to make one document point at
    // two different chains. Neither reading is worth accepting.
    const signed = await signReceipt("decision", record(), bankKey);
    const [h, payload, s] = signed.jws.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.zks.hash = "f".repeat(64);
    const tampered = [h, Buffer.from(JSON.stringify(decoded)).toString("base64url"), s].join(".");
    await expect(verifyReceipt(tampered, { publicJwks: [bankJwk], issuer: "bank.example" })).rejects.toThrow();
  });

  it("rejects a receipt whose record was edited after signing", async () => {
    const signed = await signReceipt("decision", record(), bankKey);
    const [h, payload, s] = signed.jws.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    decoded.zks.record.action = "payment:initiate";
    const tampered = [h, Buffer.from(JSON.stringify(decoded)).toString("base64url"), s].join(".");
    await expect(verifyReceipt(tampered, { publicJwks: [bankJwk], issuer: "bank.example" })).rejects.toThrow();
  });
});

describe("it refuses to sign something a counterparty would have to reject", () => {
  it("requires an author", async () => {
    await expect(signReceipt("decision", record({ institution: "" }), bankKey)).rejects.toThrow(
      MandateError,
    );
  });

  it("requires an id, so the record can be referred to later", async () => {
    await expect(signReceipt("decision", record({ id: "  " }), bankKey)).rejects.toThrow(
      MandateError,
    );
  });
});

describe("a receipt is a statement to the world, not to one counterparty", () => {
  it("verifies with no audience supplied at all", async () => {
    // A mandate is addressed to one institution. A receipt has to be checkable
    // by the consumer, the other party, a regulator or a court — binding it to
    // an audience would make it useless to exactly those people.
    const signed = await signReceipt("outcome", { ...record(), id: "out_1" }, bankKey);
    const v = await verifyReceipt(signed.jws, { publicJwks: [bankJwk], issuer: "bank.example" });
    expect(v.record.id).toBe("out_1");
  });
});
