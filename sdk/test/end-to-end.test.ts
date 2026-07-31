import { describe, expect, it } from "vitest";
import { generateKeyPair, exportJWK, type JWK } from "jose";
import { issueMandate, verifyMandate, publicJwkFor, type SigningKey } from "../src/mandate.js";
import { decide } from "../src/decision.js";
import { buildMandateRef, draftDecisionRecord, adjudicate } from "../src/settlement.js";

/**
 * The same round trip run live against the production app before this SDK
 * shipped: issue a real mandate, verify it, decide on an action, draft a
 * settlement decision link, and adjudicate the resulting chain. That live
 * run is what caught the prevHash bug in the first place (hashing the
 * reference object instead of reusing the mandate's own token hash) — this
 * test is the permanent version of that same proof, so it can't regress
 * silently in this package either.
 */
describe("full mandate -> decide -> settle -> adjudicate round trip", () => {
  it("produces a real, non-broken verdict from a genuinely issued and verified mandate", async () => {
    const { privateKey, publicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const privateJwk = await exportJWK(privateKey);
    const key: SigningKey = { kid: "test-key-1", privateJwk };

    const token = await issueMandate(
      {
        jti: "e2e-test-1",
        issuer: "https://zakai.example",
        audience: "test-bank",
        subject: "user-123",
        principal: { name: "Test User" },
        scopes: ["contract:cancel", "dispute:charge"],
        market: "IL",
        statement: "Cancel my subscription and dispute a charge if refused.",
      },
      key,
    );

    const publicJwk = await publicJwkFor(key);
    expect((publicJwk as JWK).d).toBeUndefined(); // never leaks the private component

    const claims = await verifyMandate(token, { audience: "test-bank", publicJwks: [publicJwk] });
    expect(claims.aud).toBe("test-bank");
    expect(claims.scopes).toContain("contract:cancel");

    const result = decide({
      claims,
      action: "contract:cancel",
      audience: "test-bank",
      actConfirmation: "ref-abc-123",
      revocation: "unknown", // an institution that hasn't checked yet — the honest default
    });
    expect(result.decision).toBe("deny");
    expect(result.reason).toBe("revocation_unknown");

    const mandateRef = buildMandateRef(claims, token);
    const decisionRecord = draftDecisionRecord(mandateRef, {
      institution: "test-bank",
      action: "contract:cancel",
      decision: result.decision,
      reason: result.reason,
      actConfirmation: "ref-abc-123",
    });

    const verdict = adjudicate({ mandate: mandateRef, decision: decisionRecord });
    expect(verdict.verdict).toBe("refused_with_reason");
    expect(verdict.verdict).not.toBe("broken_chain");

    // And unrelated key material never verifies this token.
    const { publicKey: otherPublicKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const otherJwk = await exportJWK(otherPublicKey);
    await expect(verifyMandate(token, { audience: "test-bank", publicJwks: [otherJwk] })).rejects.toThrow();
    void publicKey;
  });

  it("permits a properly confirmed act once revocation is known-active", async () => {
    const { privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
    const privateJwk = await exportJWK(privateKey);
    const key: SigningKey = { kid: "test-key-2", privateJwk };

    const token = await issueMandate(
      {
        jti: "e2e-test-2",
        issuer: "https://zakai.example",
        audience: "test-bank",
        subject: "user-456",
        principal: { name: "Another User" },
        scopes: ["read:accounts"],
        market: "IL",
        statement: "Read my account list.",
      },
      key,
    );

    const publicJwk = await publicJwkFor(key);
    const claims = await verifyMandate(token, { audience: "test-bank", publicJwks: [publicJwk] });
    const result = decide({ claims, action: "read:accounts", audience: "test-bank", revocation: "active" });
    expect(result.decision).toBe("permit");

    const mandateRef = buildMandateRef(claims, token);
    const decisionRecord = draftDecisionRecord(mandateRef, {
      institution: "test-bank",
      action: "read:accounts",
      decision: "permit",
    });
    const verdict = adjudicate({ mandate: mandateRef, decision: decisionRecord });
    expect(verdict.verdict).toBe("authorized_not_performed");
    expect(verdict.burden).toBe("institution");
  });
});
