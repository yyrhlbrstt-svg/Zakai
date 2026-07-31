import { describe, expect, it } from "vitest";
import {
  ALL_FORBIDDEN,
  DOMAINS,
  domainDef,
  domainDocument,
  domainOf,
  isForbiddenAnywhere,
  liveDomains,
} from "./domains";
import { FORBIDDEN_SCOPES, SCOPES } from "./scopes";
import { decide } from "./decision";
import type { MandateClaims } from "./mandate";

const NOW = new Date("2026-07-29T12:00:00Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function claims(scopes: string[]): MandateClaims {
  return {
    v: 1,
    jti: "mnd_domain",
    iss: "https://test.zakai.invalid",
    aud: "inst",
    sub: "usr",
    principal: { name: "P" },
    scopes,
    market: "IL",
    iat: nowSec - 10,
    nbf: nowSec - 10,
    exp: nowSec + 1000,
    statement: "…",
  };
}

describe("every domain states what an agent can never do", () => {
  it("gives each one a categorical limit in the words a risk committee needs", () => {
    // The limit is the sentence that gets a yes. Without it the credential is
    // just another API key, and no regulated counterparty accepts one of those
    // on behalf of their customer.
    for (const d of DOMAINS) {
      expect(d.limit.trim().length).toBeGreaterThan(40);
      expect(d.limit).toMatch(/never/i);
    }
  });

  it("gives each one a non-empty list of acts it forbids", () => {
    for (const d of DOMAINS) expect(d.forbidden.length).toBeGreaterThan(0);
  });

  it("keeps the finance limit exactly what it always was", () => {
    // Broadening the vocabulary must not quietly renegotiate the promise the
    // existing one already made to anybody who integrated against it.
    expect(domainDef("finance")!.forbidden).toEqual(FORBIDDEN_SCOPES);
  });

  it("fixes the limits of sectors that have no customer yet", () => {
    // A categorical limit decided after a sector's first customer asks for an
    // exception is not a limit, it is a negotiating position. Deciding while
    // nothing is at stake is the only time the decision is honest.
    const reserved = DOMAINS.filter((d) => d.status === "reserved");
    expect(reserved.length).toBeGreaterThanOrEqual(4);
    for (const d of reserved) expect(d.forbidden.length).toBeGreaterThan(0);
  });

  it("has exactly one live domain today, and says so", () => {
    expect(liveDomains().map((d) => d.id)).toEqual(["finance"]);
  });

  it("has no duplicate ids", () => {
    const ids = DOMAINS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("prohibitions are global, not per sector", () => {
  it("collects every domain's forbidden acts into one enforced set", () => {
    for (const d of DOMAINS) {
      for (const f of d.forbidden) expect(ALL_FORBIDDEN).toContain(f);
    }
  });

  it("refuses a health prohibition inside a finance mandate", () => {
    // Scoping prohibitions per domain would let an issuer reach a forbidden act
    // by declaring itself to be in a different sector. That is not a limit, it
    // is a formality.
    expect(isForbiddenAnywhere("treatment:consent")).toBe(true);
    const d = decide({
      claims: claims(["read:accounts", "treatment:consent"]),
      action: "read:accounts",
      audience: "inst",
      revocation: "active",
      now: NOW,
    });
    expect(d.decision).toBe("deny");
    expect(d.reason).toBe("scope_forbidden");
  });

  it("refuses a finance prohibition inside any other sector too", () => {
    expect(isForbiddenAnywhere("payment:initiate")).toBe(true);
  });

  it("cannot be stepped around with a domain prefix", () => {
    // The obvious evasion: same act, new label.
    expect(isForbiddenAnywhere("health/treatment:consent")).toBe(true);
    expect(isForbiddenAnywhere("finance/payment:initiate")).toBe(true);
    const d = decide({
      claims: claims(["health/treatment:consent"]),
      action: "health/treatment:consent",
      audience: "inst",
      revocation: "active",
      now: NOW,
    });
    expect(d.reason).toBe("scope_forbidden");
  });

  it("refuses every listed act, from every domain, at the decision point", () => {
    for (const scope of ALL_FORBIDDEN) {
      const d = decide({
        claims: claims([scope]),
        action: scope,
        audience: "inst",
        revocation: "active",
        now: NOW,
      });
      expect(d.reason).toBe("scope_forbidden");
    }
  });

  it("does not forbid anything that is in the live vocabulary", () => {
    // A prohibition overlapping a granted scope would make an issued mandate
    // permanently unusable, which is a worse failure than either alone.
    for (const s of SCOPES) expect(ALL_FORBIDDEN).not.toContain(s.scope);
  });
});

describe("the existing vocabulary is untouched", () => {
  it("still resolves every current scope, without a prefix", () => {
    // Changing the strings would break every mandate already issued and every
    // implementation already conformant, in exchange for tidiness.
    for (const s of SCOPES) expect(domainOf(s.scope)).toBe("finance");
  });

  it("reads a prefix when one is present", () => {
    expect(domainOf("health/read:records")).toBe("health");
    expect(domainOf("government/claim:file")).toBe("government");
  });

  it("returns nothing for a scope it does not recognise", () => {
    expect(domainOf("invented:verb")).toBeUndefined();
  });

  it("still permits an ordinary finance act", () => {
    const d = decide({
      claims: claims(["read:accounts"]),
      action: "read:accounts",
      audience: "inst",
      revocation: "active",
      now: NOW,
    });
    expect(d.decision).toBe("permit");
  });
});

describe("the published statement", () => {
  it("names what agents may never do, per sector", () => {
    const doc = domainDocument();
    expect(doc.domains.length).toBe(DOMAINS.length);
    for (const d of doc.domains) {
      expect(d.limit.length).toBeGreaterThan(40);
      expect(d.never.length).toBeGreaterThan(0);
    }
  });

  it("says plainly that prohibitions cross sector boundaries", () => {
    expect(domainDocument().note).toMatch(/another sector/i);
  });

  it("marks which sectors are live rather than implying all are", () => {
    // Publishing a reserved vocabulary as though it were issuable is the kind
    // of overstatement a counterparty checks exactly once.
    const doc = domainDocument();
    expect(doc.domains.filter((d) => d.status === "live").map((d) => d.id)).toEqual(["finance"]);
  });

  it("serialises without loss", () => {
    const doc = domainDocument();
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});
