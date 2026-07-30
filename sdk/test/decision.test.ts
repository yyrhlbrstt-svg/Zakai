import { describe, expect, it } from "vitest";
import { decide, permittedActions, type DecisionRequest } from "../src/decision.js";
import { FORBIDDEN_SCOPES } from "../src/scopes.js";
import type { MandateClaims } from "../src/mandate.js";

// A faithful subset of the production app's decision.test.ts vectors — this
// SDK ports the logic, so it must pass the same shape of proof, not a
// different one invented for the SDK.

const NOW = new Date("2026-07-29T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function claims(over: Partial<MandateClaims> = {}): MandateClaims {
  return {
    v: 1,
    jti: "mnd_test_1",
    iss: "https://zakai-3uxj.vercel.app",
    aud: "bank.example",
    sub: "usr_1",
    principal: { name: "Test User", reference: "012345678" },
    scopes: ["read:accounts", "dispute:charge"],
    market: "IL",
    iat: nowSec - 100,
    nbf: nowSec - 100,
    exp: nowSec + 3600,
    statement: "…",
    ...over,
  };
}

const base = (over: Partial<DecisionRequest> = {}): DecisionRequest => ({
  claims: claims(),
  action: "read:accounts",
  audience: "bank.example",
  revocation: "active",
  now: NOW,
  ...over,
});

describe("deny by default", () => {
  it("permits only the explicit case", () => {
    expect(decide(base()).decision).toBe("permit");
  });

  it("denies a scope that was never granted", () => {
    const d = decide(base({ action: "read:payroll" }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("scope_not_granted");
  });

  it("denies a scope that is not in the vocabulary at all", () => {
    const d = decide(base({ action: "accounts:drain", claims: claims({ scopes: ["accounts:drain"] }) }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("scope_unknown");
  });

  it("denies a mandate with no expiry rather than treating it as eternal", () => {
    const d = decide(base({ claims: claims({ exp: undefined as unknown as number }) }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("malformed_claims");
  });

  it("denies an expired mandate", () => {
    const d = decide(base({ claims: claims({ exp: nowSec - 1 }) }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("expired");
  });

  it("denies before the mandate's start time", () => {
    const d = decide(base({ claims: claims({ nbf: nowSec + 1000 }) }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("not_yet_valid");
  });

  it("denies a mismatched audience even with a valid scope", () => {
    const d = decide(base({ audience: "other-bank.example" }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("audience_mismatch");
  });

  it("never permits a forbidden scope, even ahead of every other failure", () => {
    for (const forbidden of FORBIDDEN_SCOPES) {
      const d = decide(
        base({
          action: forbidden,
          claims: claims({ scopes: [forbidden], exp: nowSec - 999_999 }), // also expired
        }),
      );
      expect(d.decision).toBe("deny");
      expect(d.reason).toBe("scope_forbidden");
    }
  });

  it("requires act confirmation for a per-act scope", () => {
    const d = decide(base({ action: "dispute:charge", actConfirmation: undefined }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("act_confirmation_required");
  });

  it("permits a per-act scope once confirmation is present", () => {
    const d = decide(base({ action: "dispute:charge", actConfirmation: "ref-1" }));
    expect(d.decision).toBe("permit");
  });

  it("treats unknown revocation status as a deny, never a permit with a warning", () => {
    const d = decide(base({ revocation: "unknown" }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("revocation_unknown");
  });

  it("denies a revoked mandate", () => {
    const d = decide(base({ revocation: "revoked" }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("revoked");
  });
});

describe("permittedActions", () => {
  it("lists only the scopes this token would actually permit right now", () => {
    const permitted = permittedActions({
      claims: claims(),
      audience: "bank.example",
      revocation: "active",
      now: NOW,
    });
    expect(permitted).toContain("read:accounts");
    expect(permitted).toContain("dispute:charge");
    expect(permitted).not.toContain("read:payroll");
  });
});
