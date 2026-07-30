import { describe, expect, it } from "vitest";
import { generateKeyPair, exportJWK, SignJWT, importJWK, type JWK } from "jose";
import { issueMandate, publicJwkFor, type SigningKey } from "./mandate";
import { probeIssuer } from "./probe";
import { assessConformance } from "./conformance";

describe("probeIssuer", () => {
  async function issueSample() {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const privateJwk = await exportJWK(privateKey);
    const key: SigningKey = { kid: "probe-test-key", privateJwk };
    const token = await issueMandate(
      {
        jti: "probe-test-1",
        issuer: "https://issuer.example",
        audience: "probe-bank",
        subject: "user-probe-1",
        principal: { name: "Probe User" },
        scopes: ["contract:cancel"],
        market: "IL",
        statement: "Cancel my subscription.",
      },
      key,
    );
    const jwk = await publicJwkFor(key);
    return { token, jwk, key };
  }

  it("passes every automatable check for a genuinely well-formed, honest issuer", async () => {
    const { token, jwk } = await issueSample();
    const results = await probeIssuer({ jwks: [jwk], audience: "probe-bank", sampleValidToken: token });

    const byId = new Map(results.map((r) => [r.id, r]));
    for (const id of [
      "publishes_jwks",
      "issues_valid_jwt",
      "registered_claims_present",
      "scope_is_oauth_shaped",
      "refuses_forbidden_scope",
      "rejects_forged_signature",
      "enforces_audience",
    ] as const) {
      expect(byId.get(id)?.passed, `expected ${id} to pass: ${byId.get(id)?.detail}`).toBe(true);
    }

    expect(byId.has("enforces_expiry")).toBe(false);
    const report = assessConformance(results);
    expect(report.missing).toEqual(["enforces_expiry", "publishes_status_list", "revocation_takes_effect"]);
  });

  it("catches a leaked private key in the published JWKS", async () => {
    const { token, key } = await issueSample();
    const leaked = { ...key.privateJwk, kid: key.kid, alg: "EdDSA" } as JWK;
    const results = await probeIssuer({ jwks: [leaked], audience: "probe-bank", sampleValidToken: token });
    expect(results.find((r) => r.id === "publishes_jwks")?.passed).toBe(false);
  });

  it("fails refuses_forbidden_scope when the sample token carries a forbidden scope", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const privateJwk = await exportJWK(privateKey);
    const key: SigningKey = { kid: "probe-forbidden-key", privateJwk };
    const priv = await importJWK(privateJwk, "EdDSA");
    const nowSec = Math.floor(Date.now() / 1000);
    // issueMandate validates scopes and would throw for a forbidden one, so a
    // non-conformant issuer's token is built directly to simulate what a real
    // bad actor's JWKS + token pair would actually look like.
    const forbiddenToken = await new SignJWT({
      scope: "payment:transfer",
      zkm: { v: 1, principal: { name: "Bad Actor" }, market: "IL", statement: "x" },
    })
      .setProtectedHeader({ alg: "EdDSA", kid: key.kid, typ: "JWT" })
      .setIssuer("https://issuer.example")
      .setAudience("probe-bank")
      .setSubject("user-bad")
      .setJti("probe-forbidden-1")
      .setIssuedAt(nowSec)
      .setNotBefore(nowSec)
      .setExpirationTime(nowSec + 3600)
      .sign(priv);

    const jwk = await publicJwkFor(key);
    const results = await probeIssuer({ jwks: [jwk], audience: "probe-bank", sampleValidToken: forbiddenToken });
    expect(results.find((r) => r.id === "refuses_forbidden_scope")?.passed).toBe(false);
  });

  it("checks enforces_expiry when a genuinely expired sample is supplied", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const privateJwk = await exportJWK(privateKey);
    const key: SigningKey = { kid: "probe-expiry-key", privateJwk };
    const jwk = await publicJwkFor(key);
    const past = new Date(Date.now() - 1000 * 1000);
    const expiredToken = await issueMandate(
      {
        jti: "probe-expiry-1",
        issuer: "https://issuer.example",
        audience: "probe-bank",
        subject: "user-probe-expiry",
        principal: { name: "Probe User" },
        scopes: ["contract:cancel"],
        market: "IL",
        statement: "Cancel my subscription.",
        ttlSeconds: 10,
        now: past,
      },
      key,
    );
    const results = await probeIssuer({
      jwks: [jwk],
      audience: "probe-bank",
      sampleValidToken: expiredToken,
      sampleExpiredToken: expiredToken,
    });
    const check = results.find((r) => r.id === "enforces_expiry");
    expect(check).toBeDefined();
    expect(check?.passed).toBe(true);
  });

  it("does not fabricate a pass for enforces_expiry if a still-valid token is mislabelled as expired", async () => {
    const { token, jwk } = await issueSample();
    const results = await probeIssuer({
      jwks: [jwk],
      audience: "probe-bank",
      sampleValidToken: token,
      sampleExpiredToken: token,
    });
    expect(results.find((r) => r.id === "enforces_expiry")?.passed).toBe(false);
  });
});
