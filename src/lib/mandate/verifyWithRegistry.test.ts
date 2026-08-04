import { describe, expect, it, afterEach } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import { issueMandate, type SigningKey } from "./mandate";
import { resolveRegisteredIssuer, RegistryVerifyError } from "./verifyWithRegistry";

describe("resolveRegisteredIssuer", () => {
  const prev = process.env.MANDATE_ISSUER;

  afterEach(() => {
    if (prev === undefined) delete process.env.MANDATE_ISSUER;
    else process.env.MANDATE_ISSUER = prev;
  });

  it("resolves the canonical Zakai iss", () => {
    const row = resolveRegisteredIssuer("https://zakai-3uxj.vercel.app");
    expect(row?.name).toBe("Zakai");
    expect(row?.status).toBe("active");
  });

  it("aliases MANDATE_ISSUER onto the primary row", () => {
    process.env.MANDATE_ISSUER = "https://preview.example";
    const row = resolveRegisteredIssuer("https://preview.example");
    expect(row?.iss).toBe("https://preview.example");
    expect(row?.allowedScopes.length).toBeGreaterThan(0);
  });

  it("rejects unknown issuers", () => {
    expect(resolveRegisteredIssuer("https://evil.example")).toBeUndefined();
  });
});

describe("RegistryVerifyError", () => {
  it("carries a stable code", () => {
    const err = new RegistryVerifyError("nope", "UNKNOWN_ISSUER");
    expect(err.code).toBe("UNKNOWN_ISSUER");
    expect(err.name).toBe("RegistryVerifyError");
  });
});

describe("issueMandate iss shape (sanity for registry path)", () => {
  it("issued tokens carry an iss the registry knows", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const key: SigningKey = { kid: "t", privateJwk: await exportJWK(privateKey) };
    const token = await issueMandate(
      {
        jti: "reg-test-jti",
        issuer: "https://zakai-3uxj.vercel.app",
        audience: "bank:test",
        subject: "user-1",
        principal: { name: "Test" },
        scopes: ["contract:cancel"],
        market: "IL",
        statement: "Cancel.",
      },
      key,
    );
    expect(resolveRegisteredIssuer("https://zakai-3uxj.vercel.app")).toBeTruthy();
    expect(token.split(".")).toHaveLength(3);
  });
});
