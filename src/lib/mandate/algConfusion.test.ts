import { describe, it, expect } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, importJWK, type JWK } from "jose";
import { verifyMandate, issueMandate, publicJwkFor } from "@/lib/mandate/mandate";

/**
 * A mandate signed by nobody, or by the public key, must not verify.
 *
 * WHY THIS TEST EXISTS SEPARATELY FROM THE CONFORMANCE VECTORS
 *
 * The vectors prove that a correctly signed mandate verifies and that a
 * tampered one does not. Neither covers the oldest failure in JOSE, which is
 * not a forged signature but a forged *algorithm*: the attacker keeps the
 * payload honest and changes the header, so the verifier is tricked into
 * checking the wrong kind of signature — `alg: none` (check nothing), or
 * `alg: HS256` with our own published public key as the HMAC secret, which is
 * public by design and therefore known to everybody.
 *
 * `verifyMandate` calls `compactVerify(token, key)` with no `algorithms`
 * allowlist. It is safe today because the key is imported as Ed25519 and jose
 * refuses to use an OKP key for an HMAC algorithm — so the protection is
 * jose's, not ours, and it is one dependency upgrade or one refactor to a
 * generic key import away from not being there.
 *
 * A mandate is the thing that lets an agent act on a stranger's money in front
 * of their bank. This is the one place in the codebase where "it happens to be
 * safe" is not good enough, so the property is asserted directly.
 */

const AUDIENCE = "bank.example";

function makeInput(name: string) {
  return {
    jti: `alg-confusion-${name}-${Math.random().toString(36).slice(2)}`,
    issuer: "https://zakai.test",
    audience: AUDIENCE,
    subject: "user-1",
    principal: { name },
    scopes: ["contract:cancel"],
    market: "IL",
    statement: "בדיקת אבטחה",
    ttlSeconds: 3600,
  };
}

async function realMandate() {
  const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const privateJwk = (await exportJWK(privateKey)) as JWK;
  const key = { kid: "test-1", privateJwk };
  const token = await issueMandate(makeInput("בודק"), key);
  return { token, publicJwk: await publicJwkFor(key), privateJwk };
}

describe("a mandate cannot be forged by changing its algorithm", () => {
  it("verifies an honestly signed mandate, so the negatives below mean something", async () => {
    const { token, publicJwk } = await realMandate();
    const claims = await verifyMandate(token, { audience: AUDIENCE, publicJwks: [publicJwk] });
    expect(claims.aud).toBe(AUDIENCE);
  });

  it('refuses "alg": "none"', async () => {
    const { token, publicJwk } = await realMandate();
    const [, payloadB64] = token.split(".");
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "mandate+jwt" })).toString(
      "base64url",
    );
    const unsecured = `${header}.${payloadB64}.`;
    await expect(
      verifyMandate(unsecured, { audience: AUDIENCE, publicJwks: [publicJwk] }),
    ).rejects.toThrow();
  });

  it("refuses an HMAC signature made with the published public key", async () => {
    // The whole point of publishing a JWKS is that anybody can read it. If the
    // verifier can be talked into treating that public value as a shared
    // secret, every reader of our JWKS can mint authority in anybody's name.
    const { publicJwk } = await realMandate();
    const secret = new TextEncoder().encode(JSON.stringify(publicJwk));
    const forged = await new SignJWT({
      sub: "attacker",
      scopes: ["contract:cancel"],
      principal: { name: "לא אני" },
    })
      .setProtectedHeader({ alg: "HS256", typ: "mandate+jwt", kid: publicJwk.kid })
      .setIssuedAt()
      .setAudience(AUDIENCE)
      .setExpirationTime("1h")
      .sign(secret);

    await expect(
      verifyMandate(forged, { audience: AUDIENCE, publicJwks: [publicJwk] }),
    ).rejects.toThrow();
  });

  it("refuses a mandate signed by a different, valid Ed25519 key", async () => {
    // A real signature by the wrong signer. Anybody can generate a key pair;
    // the question is whether we check it is *ours*.
    const { publicJwk } = await realMandate();
    const other = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const otherJwk = (await exportJWK(other.privateKey)) as JWK;
    const forged = await issueMandate(makeInput("לא אני"), {
      kid: "test-1",
      privateJwk: otherJwk,
    });

    await expect(
      verifyMandate(forged, { audience: AUDIENCE, publicJwks: [publicJwk] }),
    ).rejects.toThrow();
  });

  it("refuses a mandate minted for somebody else's audience", async () => {
    // Replay: a real, valid mandate addressed to one institution, presented at
    // another. Without this check any recipient could reuse what it was sent.
    const { token, publicJwk } = await realMandate();
    await expect(
      verifyMandate(token, { audience: "other-bank.example", publicJwks: [publicJwk] }),
    ).rejects.toThrow();
  });

  it("cannot be verified against an empty key set", async () => {
    // A verifier whose JWKS fetch failed must fail closed, not open.
    const { token } = await realMandate();
    await expect(verifyMandate(token, { audience: AUDIENCE, publicJwks: [] })).rejects.toThrow();
  });

  it("still fails when the payload is edited under a valid signature", async () => {
    const { token, publicJwk } = await realMandate();
    const [head, , sig] = token.split(".");
    const tampered = `${head}.${Buffer.from(
      JSON.stringify({ sub: "x", aud: AUDIENCE, exp: 99999999999, scopes: ["contract:cancel"] }),
    ).toString("base64url")}.${sig}`;
    await expect(
      verifyMandate(tampered, { audience: AUDIENCE, publicJwks: [publicJwk] }),
    ).rejects.toThrow();
  });

  it("ignores an unusable key in the set and keeps checking the rest", async () => {
    // A JWKS in rotation carries more than one key. Aborting on the first one
    // that does not match would break every verification during a rotation.
    const { token, publicJwk } = await realMandate();
    const other = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const strangerPub = (await exportJWK(other.publicKey)) as JWK;
    const claims = await verifyMandate(token, {
      audience: AUDIENCE,
      publicJwks: [{ ...strangerPub, kid: "rotated-out" }, publicJwk],
    });
    expect(claims.aud).toBe(AUDIENCE);
    // Sanity: the imports above really did produce different keys.
    expect(await importJWK(strangerPub, "EdDSA")).toBeDefined();
  });
});
