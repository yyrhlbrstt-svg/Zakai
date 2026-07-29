import { describe, expect, it } from "vitest";
import {
  checkDelegation,
  delegationClaim,
  generateIssuerKey,
  hashIssuerKey,
  issuerKeyMatches,
  type DelegationCheck,
} from "./delegation";
import { FORBIDDEN_SCOPES } from "./scopes";
import { ALL_FORBIDDEN } from "./domains";

const AGENT: DelegationCheck = {
  slug: "agent.example",
  allowedScopes: ["read:accounts", "dispute:charge"],
  status: "active",
};

describe("an issuer cannot exceed its own grant", () => {
  it("permits exactly what it was admitted for", () => {
    expect(checkDelegation(AGENT, ["read:accounts"])).toEqual({
      ok: true,
      scopes: ["read:accounts"],
    });
  });

  it("refuses a scope outside its grant, even though the scope is real", () => {
    // The subset rule is the whole point. An issuer that could exceed its grant
    // by asking for more is not constrained, it is trusted — and a registry
    // built on trusting its members is a mailing list.
    const r = checkDelegation(AGENT, ["read:accounts", "read:payroll"]);
    expect(r).toMatchObject({ ok: false, reason: "scope_not_permitted", scope: "read:payroll" });
  });

  it("refuses an invented scope", () => {
    expect(checkDelegation(AGENT, ["invented:verb"])).toMatchObject({
      ok: false,
      reason: "scope_unknown",
    });
  });

  it("refuses an empty request rather than issuing an empty mandate", () => {
    expect(checkDelegation(AGENT, [])).toMatchObject({ ok: false, reason: "no_scopes" });
  });
});

describe("the categorical limits hold for delegated issuers too", () => {
  it("refuses every outward-money act", () => {
    for (const scope of FORBIDDEN_SCOPES) {
      const wide: DelegationCheck = { ...AGENT, allowedScopes: [scope] };
      // Even when the registry row itself has been tampered to allow it.
      expect(checkDelegation(wide, [scope])).toMatchObject({
        ok: false,
        reason: "scope_forbidden",
      });
    }
  });

  it("refuses every other sector's prohibitions as well", () => {
    for (const scope of ALL_FORBIDDEN) {
      expect(checkDelegation({ ...AGENT, allowedScopes: [scope] }, [scope])).toMatchObject({
        ok: false,
        reason: "scope_forbidden",
      });
    }
  });

  it("reports forbidden separately from not-permitted", () => {
    // An issuer asking for an act no mandate may ever carry is a different
    // event from one asking outside its own grant, and an operator reading the
    // logs has to be able to tell them apart.
    const forbidden = checkDelegation(AGENT, ["payment:initiate"]);
    const notMine = checkDelegation(AGENT, ["read:payroll"]);
    expect(forbidden).toMatchObject({ reason: "scope_forbidden" });
    expect(notMine).toMatchObject({ reason: "scope_not_permitted" });
  });
});

describe("suspension and unknown issuers", () => {
  it("refuses a suspended issuer without needing a key rotation", () => {
    // The moment you need to suspend somebody is the moment you cannot afford
    // a deployment.
    expect(checkDelegation({ ...AGENT, status: "suspended" }, ["read:accounts"])).toMatchObject({
      ok: false,
      reason: "suspended",
    });
  });

  it("refuses an unrecognised issuer", () => {
    expect(checkDelegation(null, ["read:accounts"])).toMatchObject({
      ok: false,
      reason: "unknown_issuer",
    });
  });
});

describe("credentials", () => {
  it("never stores the key itself", () => {
    // A leaked table must not hand somebody the ability to issue authority in
    // other people's names.
    const key = generateIssuerKey();
    const hash = hashIssuerKey(key);
    expect(hash).not.toContain(key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("prefixes the key so a leak is greppable", () => {
    // Including by the automated scanners that find these before an attacker
    // does.
    expect(generateIssuerKey()).toMatch(/^zkid_/);
  });

  it("issues a different key every time", () => {
    expect(generateIssuerKey()).not.toBe(generateIssuerKey());
  });

  it("matches a correct key and rejects a wrong one", () => {
    const key = generateIssuerKey();
    const hash = hashIssuerKey(key);
    expect(issuerKeyMatches(key, hash)).toBe(true);
    expect(issuerKeyMatches(generateIssuerKey(), hash)).toBe(false);
  });

  it("does not throw on a malformed stored hash", () => {
    // A comparison that throws on bad input is one whose caller wraps it in a
    // try/catch, and that catch block eventually admits somebody.
    expect(() => issuerKeyMatches("anything", "not-hex")).not.toThrow();
    expect(issuerKeyMatches("anything", "not-hex")).toBe(false);
    expect(issuerKeyMatches("anything", "")).toBe(false);
  });
});

describe("the delegation is visible in the token", () => {
  it("names the agent", () => {
    const claim = delegationClaim("agent.example", "Agent Example");
    expect(claim.on_behalf_of.agent).toBe("agent.example");
    expect(claim.on_behalf_of.name).toBe("Agent Example");
  });

  it("says plainly who verified the principal, and who did not", () => {
    // An institution must be able to tell "Zakai's own user consented" from
    // "Zakai signed this for an agent whose verification we did not perform".
    // Pricing those the same would be vouching for something we never did.
    const claim = delegationClaim("agent.example", "Agent Example");
    expect(claim.note).toMatch(/verified by that agent, not by Zakai/i);
  });
});
