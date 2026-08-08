import { describe, expect, it } from "vitest";
import { SCOPES, FORBIDDEN_SCOPES } from "./scopes";
import { explainAuthority, explainScope, scopesFromMandatePayload } from "./explainScopes";

describe("explainScope", () => {
  it("gives a plain-language summary for a real scope", () => {
    const e = explainScope("read:transactions");
    expect(e.recognised).toBe(true);
    expect(e.summary).toBeTruthy();
    expect(e.tier).toBe("read");
  });

  it("explains every scope in the catalogue, so none renders blank", () => {
    // A scope with no summary would show a person an empty permission line.
    for (const def of SCOPES) {
      const e = explainScope(def.scope);
      expect(e.recognised, `${def.scope} not recognised`).toBe(true);
      expect(e.summary, `${def.scope} has no summary`).toBeTruthy();
    }
  });

  it("tolerates surrounding whitespace", () => {
    expect(explainScope("  read:transactions  ").recognised).toBe(true);
  });

  /**
   * Guessing downwards on an unknown scope would understate a real grant to
   * the one person entitled to understand it. So the unknown case assumes the
   * most dangerous shape, not the least.
   */
  it("never invents a description for an unknown scope", () => {
    const e = explainScope("read:everything-forever");
    expect(e.recognised).toBe(false);
    expect(e.summary).toBeNull();
    expect(e.needsConfirmation).toBe(true);
    expect(e.tier).toBe("unknown");
  });

  it("marks a forbidden scope as forbidden", () => {
    const forbidden = FORBIDDEN_SCOPES[0];
    expect(explainScope(forbidden).forbidden).toBe(true);
  });
});

describe("explainAuthority", () => {
  it("names what the agent can do without asking again", () => {
    const acting = SCOPES.find((s) => s.tier !== "read" && !s.perActConfirmation);
    if (!acting) return; // catalogue may legitimately require confirmation for all
    const summary = explainAuthority([acting.scope]);
    expect(summary.silentActions.map((s) => s.scope)).toContain(acting.scope);
  });

  it("does not list a confirmation-gated act as silent", () => {
    const gated = SCOPES.find((s) => s.perActConfirmation);
    if (!gated) return;
    expect(explainAuthority([gated.scope]).silentActions).toEqual([]);
  });

  it("recognises a read-only authority", () => {
    const reads = SCOPES.filter((s) => s.tier === "read").map((s) => s.scope);
    expect(explainAuthority(reads).readOnly).toBe(true);
    expect(explainAuthority(reads).silentActions).toEqual([]);
  });

  it("is not read-only once anything can act", () => {
    const read = SCOPES.find((s) => s.tier === "read");
    const act = SCOPES.find((s) => s.tier !== "read");
    if (!read || !act) return;
    expect(explainAuthority([read.scope, act.scope]).readOnly).toBe(false);
  });

  it("surfaces unknown scopes as problems rather than hiding them", () => {
    const summary = explainAuthority(["read:transactions", "mystery:scope"]);
    expect(summary.problems.map((p) => p.scope)).toEqual(["mystery:scope"]);
  });

  it("has no problems for a clean authority", () => {
    expect(explainAuthority(["read:transactions"]).problems).toEqual([]);
  });

  it("is not read-only when there are no scopes at all", () => {
    // An empty grant must not read as a reassuring "read only".
    expect(explainAuthority([]).readOnly).toBe(false);
  });
});

describe("scopesFromMandatePayload", () => {
  it("reads the scopes out of a compact JWS payload", () => {
    const payload = Buffer.from(JSON.stringify({ scopes: ["read:bills", "dispute:charge"] }))
      .toString("base64url");
    expect(scopesFromMandatePayload(`h.${payload}.sig`)).toEqual(["read:bills", "dispute:charge"]);
  });

  it("returns nothing rather than throwing on junk", () => {
    // This runs while rendering a page; a throw here would blank the screen
    // someone opened specifically to revoke something.
    expect(scopesFromMandatePayload("not-a-jws")).toEqual([]);
    expect(scopesFromMandatePayload("")).toEqual([]);
    expect(scopesFromMandatePayload("a.!!!.c")).toEqual([]);
  });

  it("ignores non-string entries instead of rendering them", () => {
    const payload = Buffer.from(JSON.stringify({ scopes: ["read:bills", 42, null] }))
      .toString("base64url");
    expect(scopesFromMandatePayload(`h.${payload}.sig`)).toEqual(["read:bills"]);
  });

  it("returns nothing when the payload carries no scopes", () => {
    const payload = Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url");
    expect(scopesFromMandatePayload(`h.${payload}.sig`)).toEqual([]);
  });
});
