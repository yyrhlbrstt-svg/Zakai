import { describe, expect, it } from "vitest";
import {
  checkAuthorizationAsk,
  DEFAULT_GRANT_SECONDS,
  MAX_GRANT_SECONDS,
  MAX_SCOPES_PER_REQUEST,
  type RegisteredAgent,
} from "./request";
import { FORBIDDEN_SCOPES } from "@/lib/mandate/scopes";

/**
 * These decide what a stranger may ask a person to approve.
 *
 * The cost of being wrong is not a broken page. It is somebody granting
 * authority they did not understand, to an agent that should never have been
 * able to ask, redirected to a party that should never have received it. So
 * every rejection path has a test, including the ones that look paranoid.
 */
const agent: RegisteredAgent = {
  slug: "acme-assistant",
  name: "Acme Assistant",
  redirectUris: ["https://acme.example/callback", "http://localhost:8080/cb"],
  status: "approved",
};

const ask = {
  scopes: ["read:transactions"],
  redirectUri: "https://acme.example/callback",
  purpose: "To find forgotten subscriptions on your card statement.",
};

describe("checkAuthorizationAsk", () => {
  it("accepts a well-formed ask", () => {
    const out = checkAuthorizationAsk(agent, ask);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.scopes).toEqual(["read:transactions"]);
      expect(out.grantSeconds).toBe(DEFAULT_GRANT_SECONDS);
    }
  });

  it("refuses an agent that has not been approved", () => {
    for (const status of ["pending", "suspended", "", "APPROVED"]) {
      const out = checkAuthorizationAsk({ ...agent, status }, ask);
      expect(out.ok, status).toBe(false);
    }
  });

  it("refuses every forbidden scope, by name", () => {
    // The whole protocol's promise is that it cannot move money outward. If
    // one of these ever became askable, the promise is gone and no amount of
    // consent copy repairs it.
    for (const scope of FORBIDDEN_SCOPES) {
      const out = checkAuthorizationAsk(agent, { ...ask, scopes: [scope] });
      expect(out.ok, scope).toBe(false);
      if (!out.ok) expect(out.reason, scope).toBe("forbidden_scope");
    }
  });

  it("refuses a forbidden scope even when smuggled beside a legitimate one", () => {
    const out = checkAuthorizationAsk(agent, {
      ...ask,
      scopes: ["read:transactions", "payment:transfer"],
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("forbidden_scope");
  });

  it("refuses a scope nobody has defined", () => {
    const out = checkAuthorizationAsk(agent, { ...ask, scopes: ["read:everything"] });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("unknown_scope");
  });

  /**
   * Redirect handling is where authorization protocols get broken in practice.
   * A grant sent to an attacker's URL is the grant, whatever the consent
   * screen said.
   */
  it("refuses a redirect that is not registered, exactly", () => {
    const attacks = [
      "https://acme.example/callback/../evil",
      "https://acme.example/callback?x=1",
      "https://acme.example/callback#x",
      "https://acme.example.evil.test/callback",
      "https://evil.test/callback",
      "https://acme.example/Callback",
      "https://acme.example/callback/",
    ];
    for (const redirectUri of attacks) {
      const out = checkAuthorizationAsk(agent, { ...ask, redirectUri });
      expect(out.ok, redirectUri).toBe(false);
    }
  });

  it("refuses clear-text redirects except on localhost", () => {
    const out = checkAuthorizationAsk(
      { ...agent, redirectUris: ["http://acme.example/cb"] },
      { ...ask, redirectUri: "http://acme.example/cb" },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("redirect_insecure");

    // How every integrator develops — allowed, and only here.
    const local = checkAuthorizationAsk(agent, { ...ask, redirectUri: "http://localhost:8080/cb" });
    expect(local.ok).toBe(true);
  });

  it("refuses a request that cannot say what it is for", () => {
    for (const purpose of ["", "   ", "misc", "stuff"]) {
      const out = checkAuthorizationAsk(agent, { ...ask, purpose });
      expect(out.ok, JSON.stringify(purpose)).toBe(false);
      if (!out.ok) expect(out.reason).toBe("purpose_missing");
    }
  });

  it("refuses an empty or oversized scope list", () => {
    expect(checkAuthorizationAsk(agent, { ...ask, scopes: [] }).ok).toBe(false);
    expect(checkAuthorizationAsk(agent, { ...ask, scopes: ["", "  "] }).ok).toBe(false);
    const many = Array.from({ length: MAX_SCOPES_PER_REQUEST + 1 }, (_, i) => `read:x${i}`);
    const out = checkAuthorizationAsk(agent, { ...ask, scopes: many });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("too_many_scopes");
  });

  it("collapses duplicates rather than counting them", () => {
    const out = checkAuthorizationAsk(agent, {
      ...ask,
      scopes: ["read:transactions", "read:transactions"],
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.scopes).toEqual(["read:transactions"]);
  });

  it("bounds how long a grant may last", () => {
    expect(checkAuthorizationAsk(agent, { ...ask, grantSeconds: 30 }).ok).toBe(false);
    expect(checkAuthorizationAsk(agent, { ...ask, grantSeconds: MAX_GRANT_SECONDS + 1 }).ok).toBe(
      false,
    );
    expect(checkAuthorizationAsk(agent, { ...ask, grantSeconds: 3600 }).ok).toBe(true);
    // Not an integer, and not a number of seconds anybody meant.
    expect(checkAuthorizationAsk(agent, { ...ask, grantSeconds: 3600.5 }).ok).toBe(false);
  });
});
