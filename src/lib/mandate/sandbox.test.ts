import { describe, expect, it } from "vitest";
import { compactVerify, importJWK, decodeJwt, decodeProtectedHeader } from "jose";
import {
  SANDBOX_AUDIENCE,
  SANDBOX_KID,
  SANDBOX_TTL_SECONDS,
  issueSandboxMandate,
  sandboxIssuer,
  sandboxJwks,
} from "./sandbox";
import { verifyMandateWithTrustRegistry } from "./verifyWithRegistry";
import { verifyMandate, MandateError } from "./mandate";

const ORIGIN = "https://zakai.test";
const scopes = ["read:bills"];

describe("sandbox mandate — it is genuinely valid", () => {
  /**
   * The whole point is that the cryptography is real. A demo that fakes the
   * signature teaches nothing, and the tamper demonstration below would be
   * theatre rather than proof.
   */
  it("verifies against the sandbox JWKS", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    const key = await importJWK((await sandboxJwks()).keys[0], "EdDSA");
    await expect(compactVerify(token, key)).resolves.toBeDefined();
  });

  it("fails verification after a single character is changed", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    const key = await importJWK((await sandboxJwks()).keys[0], "EdDSA");

    // Flip a character in the payload segment, leaving the structure intact.
    const [h, p, s] = token.split(".");
    const flipped = p[10] === "A" ? "B" : "A";
    const tampered = `${h}.${p.slice(0, 10)}${flipped}${p.slice(11)}.${s}`;

    await expect(compactVerify(tampered, key)).rejects.toThrow();
  });

  it("carries the scopes it was asked for", async () => {
    const { token } = await issueSandboxMandate({
      origin: ORIGIN,
      scopes: ["read:bills", "dispute:charge"],
    });
    // OAuth-shaped — space-delimited string, same as the production issuer —
    // not a bare array, so a verifier that only understands `scope` still
    // reads a sandbox token correctly.
    expect(decodeJwt(token).scope).toBe("read:bills dispute:charge");
  });

  it("signs with EdDSA under the sandbox kid", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe("EdDSA");
    expect(header.kid).toBe(SANDBOX_KID);
  });
});

describe("sandbox mandate — it cannot authorise anything", () => {
  /**
   * THE TEST THIS FILE EXISTS FOR.
   *
   * Everything else is a property of the sandbox. This is a property of
   * production: a token minted here must be refused by the real verifier. If
   * this ever passes verification, the sandbox has become a forgery service,
   * and no amount of labelling elsewhere would make that safe.
   */
  it("is REJECTED by the production trust-registry verifier, as an unknown issuer", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes });

    // Asserting the REASON, not merely that it threw. A bare rejects.toThrow()
    // here would also pass if the database were unreachable, or the token
    // malformed, or any other incidental failure — and would keep passing
    // after the containment itself broke. The code must be UNKNOWN_ISSUER:
    // the sandbox issuer is absent from the trust registry, so acceptance
    // would require someone to deliberately ADD it, which is a visible act
    // rather than the removal of a guard.
    await expect(
      verifyMandateWithTrustRegistry(token, { audience: SANDBOX_AUDIENCE }),
    ).rejects.toMatchObject({ code: "UNKNOWN_ISSUER" });
  });

  it("is rejected even when presented to a real-looking audience", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    await expect(
      verifyMandateWithTrustRegistry(token, { audience: "bank-hapoalim" }),
    ).rejects.toThrow();
  });

  it("names an issuer that is not the production issuer", async () => {
    const { token, issuer } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    expect(issuer).toBe(`${ORIGIN}/sandbox`);
    expect(issuer).not.toBe(ORIGIN);
    expect(decodeJwt(token).iss).toBe(issuer);
  });

  it("cannot name a real institution as its audience", async () => {
    const { token, audience } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    expect(audience).toBe(SANDBOX_AUDIENCE);
    expect(decodeJwt(token).aud).toBe(SANDBOX_AUDIENCE);
  });

  it("marks itself as sandbox inside the signature", async () => {
    // Inside, so it cannot be stripped without breaking the signature.
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    expect((decodeJwt(token) as { zkm?: { env?: string } }).zkm?.env).toBe("sandbox");
  });

  it("expires quickly enough that a copied token goes inert", async () => {
    const now = new Date("2026-08-07T12:00:00Z");
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes, now });
    const claims = decodeJwt(token);
    expect(claims.exp! - claims.iat!).toBe(SANDBOX_TTL_SECONDS);
    expect(SANDBOX_TTL_SECONDS).toBeLessThanOrEqual(900);
  });

  it("says plainly, in the statement, that it grants nothing", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    const zkm = (decodeJwt(token) as { zkm?: { statement?: string } }).zkm;
    expect(String(zkm?.statement)).toMatch(/SANDBOX/);
  });
});

describe("sandbox mandate — verifies against the reference verifier itself", () => {
  /**
   * verifyMandateWithTrustRegistry() rejects every sandbox token at the issuer
   * lookup, before it ever reaches verifyMandate()/normaliseClaims() — so the
   * "unknown issuer" tests above cannot catch a claim-shape bug in the token
   * itself. probeIssuer() (used by /api/mandate/conformance/probe) is the one
   * caller that bypasses the registry and calls verifyMandate() directly on
   * caller-supplied artifacts, which is exactly how a sandbox/production
   * shape mismatch here was previously invisible to every other test.
   */
  it("is accepted by verifyMandate() itself when presented to its own audience", async () => {
    const { token, audience } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    const claims = await verifyMandate(token, {
      audience,
      publicJwks: (await sandboxJwks()).keys,
    });
    expect(claims.scopes).toEqual(scopes);
  });

  it("is refused by verifyMandate() with AUDIENCE_MISMATCH, not a claim-shape error, for the wrong audience", async () => {
    const { token, audience } = await issueSandboxMandate({ origin: ORIGIN, scopes });
    await expect(
      verifyMandate(token, {
        audience: `${audience}-deliberately-wrong`,
        publicJwks: (await sandboxJwks()).keys,
      }),
    ).rejects.toMatchObject({ code: "AUDIENCE_MISMATCH" } satisfies Partial<MandateError>);
  });
});

describe("sandbox mandate — the protocol's own limits still apply", () => {
  it("refuses a scope the protocol forbids", async () => {
    // A sandbox that granted forbidden scopes would teach integrators a shape
    // the real issuer rejects — worse than no sandbox at all.
    await expect(
      issueSandboxMandate({ origin: ORIGIN, scopes: ["transfer:funds"] }),
    ).rejects.toThrow();
  });

  it("refuses an unknown, free-text scope", async () => {
    await expect(
      issueSandboxMandate({ origin: ORIGIN, scopes: ["do:anything"] }),
    ).rejects.toThrow();
  });

  it("refuses to issue with no scopes at all", async () => {
    await expect(issueSandboxMandate({ origin: ORIGIN, scopes: [] })).rejects.toThrow();
  });
});

describe("sandboxIssuer", () => {
  it("does not double a trailing slash", () => {
    expect(sandboxIssuer("https://zakai.test/")).toBe("https://zakai.test/sandbox");
  });
});

describe("sandbox key", () => {
  it("never exposes a private key through the public JWKS", async () => {
    const jwks = await sandboxJwks();
    for (const k of jwks.keys) {
      // `d` is the Ed25519 private scalar. Publishing it would turn the
      // sandbox JWKS into a signing oracle for anyone who fetched it.
      expect(k).not.toHaveProperty("d");
      expect(k.kty).toBe("OKP");
      expect(k.crv).toBe("Ed25519");
    }
  });

  /**
   * Stability across instances, not just calls. On Vercel the issuing request
   * and the JWKS request are routinely served by different instances; an
   * earlier ephemeral-per-process key meant a freshly issued token failed to
   * verify against the JWKS fetched a second later, which is indistinguishable
   * from tampering. Pinning the value is what makes that impossible to
   * reintroduce.
   */
  it("is a fixed key, so a token verifies against a JWKS served by any instance", async () => {
    const jwks = await sandboxJwks();
    expect(jwks.keys[0].x).toBe("oWtTInTC7O4LEKZrlCM6tErRZUAzB-aJ_PL23nVYyWs");
  });
});
