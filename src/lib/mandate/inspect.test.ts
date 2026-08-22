import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateKeyPair, exportJWK, SignJWT } from "jose";

vi.mock("server-only", () => ({}));

import { inspectMandate, looksLikeCompactJws } from "./inspect";
import { issueSandboxMandate, SANDBOX_KID } from "./sandbox";
import { MANDATE_CLAIM_NS, MANDATE_VERSION, MANDATE_TYPE } from "./mandate";

const ORIGIN = "https://inspect.test";

beforeEach(() => {
  delete process.env.MANDATE_SIGNING_JWK;
  delete process.env.MANDATE_SIGNING_KID;
  delete process.env.MANDATE_ISSUER;
});

describe("looksLikeCompactJws", () => {
  it("accepts three non-empty base64url segments and nothing else", () => {
    expect(looksLikeCompactJws("aa.bb.cc")).toBe(true);
    expect(looksLikeCompactJws("ZK-7Q4K-2M9P")).toBe(false);
    expect(looksLikeCompactJws("aa.bb")).toBe(false);
    expect(looksLikeCompactJws("aa..cc")).toBe(false);
    expect(looksLikeCompactJws("aa.bb.cc.dd")).toBe(false);
  });
});

describe("inspectMandate — a sandbox token, which is all a stranger can obtain", () => {
  it("confirms the signature and refuses to call it authority", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes: ["read:bills"] });
    const report = await inspectMandate(token);

    expect(report.signatureVerified).toBe(true);
    expect(report.environment).toBe("sandbox");
    expect(report.verdict).toBe("authentic_sandbox_no_authority");
    expect(report.issuer.registered).toBe(false);
    expect(report.keyId).toBe(SANDBOX_KID);
    // The whole promise of the endpoint: the reader can redo the check.
    expect(report.jwksUri).toBe(`${ORIGIN}/api/mandate/sandbox/jwks.json`);
  });

  it("never reports an audience as checked, whatever the outcome", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes: ["read:bills"] });
    const report = await inspectMandate(token);
    expect(report.audienceChecked).toBe(false);
    expect(report.declaredAudience).toBe("sandbox-institution");
  });

  it("fails when the signature is altered — the demonstration itself", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes: ["read:bills"] });
    const [head, body, sig] = token.split(".");
    const flipped = sig[10] === "A" ? "B" : "A";
    const tampered = `${head}.${body}.${sig.slice(0, 10)}${flipped}${sig.slice(11)}`;

    const report = await inspectMandate(tampered);
    expect(report.signatureVerified).toBe(false);
    expect(report.verdict).toBe("signature_failed");
    expect(report.claims).toBeNull();
  });

  it("fails when a claim is edited and re-encoded — the forgery that looks real", async () => {
    // The realistic attack is not random corruption: it is someone widening
    // their own scopes and re-base64ing the payload. The bytes still parse,
    // still look like a mandate, and still fail.
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes: ["read:bills"] });
    const [head, body, sig] = token.split(".");
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    claims.scope = "read:bills read:statements";
    const forged = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");

    const report = await inspectMandate(`${head}.${forged}.${sig}`);
    expect(report.signatureVerified).toBe(false);
    expect(report.verdict).toBe("signature_failed");
    expect(report.reason).toContain("altered after signing");
  });

  it("reports an expired sandbox token as authentic but unusable", async () => {
    const { token } = await issueSandboxMandate({ origin: ORIGIN, scopes: ["read:bills"] });
    // Sandbox TTL is ten minutes; an hour on is unambiguously past it.
    const report = await inspectMandate(token, { now: new Date(Date.now() + 3_600_000) });
    expect(report.signatureVerified).toBe(true);
    expect(report.verdict).toBe("authentic_but_expired");
    // The reader is told what expired, not merely that something did.
    expect(report.claims?.expiresAt).toBeTruthy();
  });
});

describe("inspectMandate — things that are not ours", () => {
  it("rejects anything that is not a compact JWS without pretending to check it", async () => {
    const report = await inspectMandate("ZK-7Q4K-2M9P");
    expect(report.verdict).toBe("not_a_mandate");
    expect(report.signatureVerified).toBe(false);
  });

  it("refuses an unregistered issuer rather than fetching keys it was handed", async () => {
    const { privateKey } = await generateKeyPair("Ed25519", { extractable: true });
    const token = await new SignJWT({
      scope: "read:bills",
      [MANDATE_CLAIM_NS]: { v: MANDATE_VERSION, market: "IL", statement: "forged" },
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "attacker-key", typ: MANDATE_TYPE })
      .setIssuer("https://not-zakai.example")
      .setAudience("some-bank")
      .setSubject("victim")
      .setJti("forged-jti")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    const report = await inspectMandate(token);
    expect(report.signatureVerified).toBe(false);
    expect(report.verdict).toBe("authentic_but_issuer_untrusted");
    expect(report.reason).toContain("not in the Zakai trust registry");
  });

  it("does not accept a self-signed token that merely names a /sandbox issuer", async () => {
    // The sandbox kid is published, so a forger can copy it. What they cannot
    // copy is a signature that verifies against the published sandbox key.
    const { privateKey } = await generateKeyPair("Ed25519", { extractable: true });
    const token = await new SignJWT({
      scope: "read:bills",
      [MANDATE_CLAIM_NS]: { v: MANDATE_VERSION, market: "IL", statement: "forged" },
    })
      .setProtectedHeader({ alg: "EdDSA", kid: SANDBOX_KID, typ: MANDATE_TYPE })
      .setIssuer(`${ORIGIN}/sandbox`)
      .setAudience("sandbox-institution")
      .setSubject("sandbox-subject")
      .setJti("forged-sandbox-jti")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(privateKey);

    const report = await inspectMandate(token);
    expect(report.signatureVerified).toBe(false);
    expect(report.verdict).toBe("signature_failed");
  });
});

describe("inspectMandate — a production-issuer token", () => {
  it("confirms a registered issuer without ever asserting the audience matched", async () => {
    const { privateKey, publicKey } = await generateKeyPair("Ed25519", { extractable: true });
    const jwk = await exportJWK(privateKey);
    process.env.MANDATE_SIGNING_JWK = JSON.stringify({ ...jwk, alg: "EdDSA", kid: "test-kid" });
    process.env.MANDATE_SIGNING_KID = "test-kid";
    process.env.MANDATE_ISSUER = ORIGIN;
    void publicKey;

    const token = await new SignJWT({
      scope: "read:bills",
      [MANDATE_CLAIM_NS]: {
        v: MANDATE_VERSION,
        market: "IL",
        statement: "Real mandate",
        principal: { name: "Sample", contactMasked: "05*-***-**89" },
      },
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "test-kid", typ: MANDATE_TYPE })
      .setIssuer(ORIGIN)
      .setAudience("bank-hapoalim")
      .setSubject("user-1")
      .setJti("prod-jti-1")
      .setIssuedAt()
      .setNotBefore("0s")
      .setExpirationTime("1h")
      .sign(privateKey);

    const report = await inspectMandate(token, { liveLookup: async () => "active" });

    expect(report.signatureVerified).toBe(true);
    expect(report.issuer.registered).toBe(true);
    expect(report.environment).toBe("production");
    expect(report.verdict).toBe("authentic_and_registered");
    expect(report.audienceChecked).toBe(false);
    expect(report.declaredAudience).toBe("bank-hapoalim");
    expect(report.revocation.state).toBe("active");
    // Contact is masked at the issuer; inspection must not widen exposure.
    expect(report.claims?.principalContactMasked).toBe("05*-***-**89");
  });

  it("calls a revoked mandate revoked even though every byte is authentic", async () => {
    const { privateKey } = await generateKeyPair("Ed25519", { extractable: true });
    const jwk = await exportJWK(privateKey);
    process.env.MANDATE_SIGNING_JWK = JSON.stringify({ ...jwk, alg: "EdDSA", kid: "test-kid" });
    process.env.MANDATE_SIGNING_KID = "test-kid";
    process.env.MANDATE_ISSUER = ORIGIN;

    const token = await new SignJWT({
      scope: "read:bills",
      [MANDATE_CLAIM_NS]: { v: MANDATE_VERSION, market: "IL", statement: "Real mandate" },
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "test-kid", typ: MANDATE_TYPE })
      .setIssuer(ORIGIN)
      .setAudience("bank-hapoalim")
      .setSubject("user-1")
      .setJti("prod-jti-2")
      .setIssuedAt()
      .setNotBefore("0s")
      .setExpirationTime("1h")
      .sign(privateKey);

    const report = await inspectMandate(token, { liveLookup: async () => "revoked" });
    expect(report.signatureVerified).toBe(true);
    expect(report.verdict).toBe("authentic_but_revoked");
  });

  it("stays at unknown rather than active when the revocation store is unreachable", async () => {
    const { privateKey } = await generateKeyPair("Ed25519", { extractable: true });
    const jwk = await exportJWK(privateKey);
    process.env.MANDATE_SIGNING_JWK = JSON.stringify({ ...jwk, alg: "EdDSA", kid: "test-kid" });
    process.env.MANDATE_SIGNING_KID = "test-kid";
    process.env.MANDATE_ISSUER = ORIGIN;

    const token = await new SignJWT({
      scope: "read:bills",
      [MANDATE_CLAIM_NS]: { v: MANDATE_VERSION, market: "IL", statement: "Real mandate" },
    })
      .setProtectedHeader({ alg: "EdDSA", kid: "test-kid", typ: MANDATE_TYPE })
      .setIssuer(ORIGIN)
      .setAudience("bank-hapoalim")
      .setSubject("user-1")
      .setJti("prod-jti-3")
      .setIssuedAt()
      .setNotBefore("0s")
      .setExpirationTime("1h")
      .sign(privateKey);

    const report = await inspectMandate(token, { liveLookup: async () => "unknown" });
    expect(report.revocation.state).toBe("unknown");
    // Unknown revocation is not a reason to call it revoked, and not a reason
    // to hide that the check did not conclude.
    expect(report.verdict).toBe("authentic_and_registered");
  });
});
