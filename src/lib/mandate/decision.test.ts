import { describe, expect, it } from "vitest";
import { decide, permittedActions, type DecisionRequest } from "./decision";
import { FORBIDDEN_SCOPES } from "./scopes";
import type { MandateClaims } from "./mandate";

const NOW = new Date("2026-07-29T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function claims(over: Partial<MandateClaims> = {}): MandateClaims {
  return {
    v: 1,
    jti: "mnd_test_1",
    iss: "https://zakai-3uxj.vercel.app",
    aud: "bank.example",
    sub: "usr_1",
    principal: { name: "דנה כהן", reference: "012345678" },
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
    // A caller inventing a scope string must not be able to widen authority by
    // guessing one the issuer never defined.
    const d = decide(base({ action: "accounts:drain", claims: claims({ scopes: ["accounts:drain"] }) }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("scope_unknown");
  });

  it("denies a mandate with no expiry rather than treating it as eternal", () => {
    // The first version of decide() skipped the expiry check when `exp` was
    // absent, which turned a malformed token into the strongest possible
    // mandate arriving through the weakest possible path.
    const d = decide(base({ claims: claims({ exp: undefined as unknown as number }) }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("malformed_claims");
  });

  it("denies a mandate with no validity start, for the same reason", () => {
    expect(decide(base({ claims: claims({ nbf: undefined as unknown as number }) })).reason)
      .toBe("malformed_claims");
  });

  it("never throws, whatever it is handed", () => {
    // An authorization function that can throw is one somebody wraps in a
    // try/catch whose catch block permits — and that somebody will be a bank.
    const nasty = [
      base({ action: "" }),
      base({ claims: claims({ scopes: [] }) }),
      base({ claims: claims({ exp: undefined as unknown as number }) }),
      base({ claims: claims({ nbf: undefined as unknown as number }) }),
      base({ audience: "" }),
    ];
    for (const req of nasty) {
      expect(() => decide(req)).not.toThrow();
      expect(decide(req).decision).toBe("deny");
    }
  });

  it("returns a decision for every input, with a reason on every deny", () => {
    const d = decide(base({ action: "read:payroll" }));
    expect(d.reason).toBeDefined();
    expect(decide(base()).reason).toBeUndefined();
  });
});

describe("money never flows outward, enforced at the decision point", () => {
  it("denies every forbidden action outright", () => {
    for (const scope of FORBIDDEN_SCOPES) {
      const d = decide(base({ action: scope }));
      expect(d.decision).toBe("deny");
      expect(d.reason).toBe("scope_forbidden");
    }
  });

  it("denies a token that carries a forbidden scope, even for an innocent action", () => {
    // Issuance is the side an attacker controls. A mandate carrying an outward
    // money scope is not one we merely decline to issue — it is one no verifier
    // honours, for anything.
    const poisoned = claims({ scopes: ["read:accounts", FORBIDDEN_SCOPES[0]] });
    const d = decide(base({ claims: poisoned, action: "read:accounts" }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("scope_forbidden");
  });

  it("keeps a forbidden scope out of the permitted list", () => {
    const poisoned = claims({ scopes: ["read:accounts", FORBIDDEN_SCOPES[0]] });
    expect(permittedActions({ claims: poisoned, audience: "bank.example", revocation: "active", now: NOW }))
      .toEqual([]);
  });
});

describe("structural mismatches are reported before scope problems", () => {
  it("denies a token presented to the wrong institution", () => {
    // More useful to an integrator than "that scope is missing".
    const d = decide(base({ audience: "other.example" }));
    expect(d.reason).toBe("audience_mismatch");
  });

  it("denies when the act concerns a different person", () => {
    expect(decide(base({ subject: "usr_2" })).reason).toBe("subject_mismatch");
  });

  it("ignores subject and market when the caller does not enforce them", () => {
    expect(decide(base({ subject: undefined, market: undefined })).decision).toBe("permit");
  });

  it("denies a mandate issued for another jurisdiction", () => {
    expect(decide(base({ market: "GB" })).reason).toBe("market_mismatch");
  });
});

describe("time", () => {
  it("denies an expired mandate", () => {
    const d = decide(base({ claims: claims({ exp: nowSec - 1 }) }));
    expect(d.reason).toBe("expired");
    expect(d.expiresInSeconds).toBe(0);
  });

  it("denies one that has not started", () => {
    expect(decide(base({ claims: claims({ nbf: nowSec + 60 }) })).reason).toBe("not_yet_valid");
  });

  it("reports the remaining life so an audit record is self-contained", () => {
    expect(decide(base()).expiresInSeconds).toBe(3600);
  });

  it("never reports a negative remaining life", () => {
    expect(decide(base({ claims: claims({ exp: nowSec - 5000 }) })).expiresInSeconds).toBe(0);
  });

  it("is reproducible — the same inputs give the same decision", () => {
    expect(decide(base())).toEqual(decide(base()));
  });
});

describe("holding a scope is not agreeing to this act", () => {
  it("denies a per-act scope with no confirmation of this act", () => {
    // "May cancel my subscriptions" is not agreement to cancel this one, and
    // this is the check every institution writes for itself and gets wrong.
    const d = decide(base({ action: "dispute:charge" }));
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("act_confirmation_required");
  });

  it("permits it once this act was confirmed", () => {
    const d = decide(base({ action: "dispute:charge", actConfirmation: "cnf_9182" }));
    expect(d.decision).toBe("permit");
    expect(d.obligations).toContain("retain_confirmation:cnf_9182");
  });

  it("treats whitespace as no confirmation at all", () => {
    expect(decide(base({ action: "dispute:charge", actConfirmation: "   " })).reason)
      .toBe("act_confirmation_required");
  });

  it("does not demand confirmation for a standing read scope", () => {
    expect(decide(base({ action: "read:accounts" })).decision).toBe("permit");
  });
});

describe("revocation is the caller's job and unknown is not fine", () => {
  it("denies a revoked mandate", () => {
    expect(decide(base({ revocation: "revoked" })).reason).toBe("revoked");
  });

  it("denies when the caller could not establish status", () => {
    // Softening this is exactly how a revoked mandate keeps working for the one
    // caller who never checks.
    expect(decide(base({ revocation: "unknown" })).reason).toBe("revocation_unknown");
  });

  it("defaults to unknown rather than to active when the field is omitted", () => {
    const { revocation: _omitted, ...withoutRevocation } = base();
    expect(decide(withoutRevocation as DecisionRequest).reason).toBe("revocation_unknown");
  });
});

describe("obligations tell the caller what to do", () => {
  it("always requires the decision to be recorded and the principal told", () => {
    const d = decide(base());
    expect(d.obligations).toContain("record:mnd_test_1");
    expect(d.obligations).toContain("notify_principal:read:accounts");
  });

  it("carries no obligations on a deny", () => {
    expect(decide(base({ action: "read:payroll" })).obligations).toEqual([]);
  });

  it("echoes the mandate id and action so one record holds the whole decision", () => {
    const d = decide(base({ action: "read:payroll" }));
    expect(d.jti).toBe("mnd_test_1");
    expect(d.action).toBe("read:payroll");
  });
});

describe("what a token is good for", () => {
  it("lists the acts that would be permitted right now", () => {
    const list = permittedActions({
      claims: claims(),
      audience: "bank.example",
      revocation: "active",
      now: NOW,
    });
    expect(list).toEqual(["read:accounts", "dispute:charge"]);
  });

  it("returns nothing when the mandate cannot be used here at all", () => {
    expect(
      permittedActions({ claims: claims(), audience: "other.example", revocation: "active", now: NOW }),
    ).toEqual([]);
  });

  it("returns nothing once expired", () => {
    expect(
      permittedActions({
        claims: claims({ exp: nowSec - 1 }),
        audience: "bank.example",
        revocation: "active",
        now: NOW,
      }),
    ).toEqual([]);
  });

  it("agrees with decide, act by act", () => {
    // The loop integrators would otherwise write themselves, and write wrong.
    const req = { claims: claims(), audience: "bank.example", revocation: "active" as const, now: NOW };
    const listed = new Set(permittedActions(req));
    for (const scope of req.claims.scopes) {
      const d = decide({ ...req, action: scope, actConfirmation: "probe" });
      expect(listed.has(scope)).toBe(d.decision === "permit");
    }
  });
});
