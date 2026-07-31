import { describe, expect, it } from "vitest";
import {
  DECISION_VECTORS,
  TEST_ISSUER,
  TEST_NOW,
  runDecisionVectors,
  vectorDocument,
} from "./vectors";
import { decide } from "./decision";
import { resolveIssuerKeysUri } from "./trustRegistry";
import { FORBIDDEN_SCOPES } from "./scopes";
import { DOMAINS } from "./domains";

describe("our own implementation passes its own vectors", () => {
  it("passes every one", () => {
    // If this ever fails, either the implementation regressed or a vector was
    // written to describe behaviour we do not actually have. Both are worth
    // stopping for — a published vector nobody's implementation satisfies is
    // worse than no vector at all.
    const report = runDecisionVectors(decide);
    expect(report.failed).toEqual([]);
    expect(report.conformant).toBe(true);
    expect(report.passed).toBe(report.total);
  });
});

describe("the vectors cover what implementations actually diverge on", () => {
  it("covers every deny reason the decision layer can produce", () => {
    // A reason with no vector is a reason two implementations will disagree
    // about, and an integrator branching on it will be broken by one of them.
    const covered = new Set(
      DECISION_VECTORS.map((v) => v.expect.reason).filter(Boolean) as string[],
    );
    for (const reason of [
      "expired",
      "not_yet_valid",
      "audience_mismatch",
      "subject_mismatch",
      "market_mismatch",
      "scope_not_granted",
      "scope_unknown",
      "scope_forbidden",
      "act_confirmation_required",
      "revoked",
      "revocation_unknown",
      "malformed_claims",
    ]) {
      expect(covered).toContain(reason);
    }
  });

  it("includes permits, not only refusals", () => {
    expect(DECISION_VECTORS.some((v) => v.expect.decision === "permit")).toBe(true);
  });

  it("pins the order when two rules could both fire", () => {
    // The vectors worth the most. Every implementation gets the simple cases
    // right; what diverges is which reason comes back when a token is both
    // expired and misaddressed.
    const ordering = DECISION_VECTORS.filter((v) => v.id.startsWith("order_"));
    expect(ordering.length).toBeGreaterThanOrEqual(3);
  });

  it("explains what each vector is for", () => {
    for (const v of DECISION_VECTORS) expect(v.pins.trim().length).toBeGreaterThan(20);
  });

  it("has no duplicate ids", () => {
    const ids = DECISION_VECTORS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("determinism", () => {
  it("evaluates at a fixed instant, never the wall clock", () => {
    // A vector that depends on the current time is a test that passes today and
    // fails on the day somebody actually runs it.
    const a = runDecisionVectors(decide);
    const b = runDecisionVectors(decide);
    expect(a).toEqual(b);
    expect(vectorDocument().evaluated_at_unix).toBe(TEST_NOW);
  });

  it("ignores any clock the caller tries to supply", () => {
    // The harness overrides `now`, so an implementation cannot be handed a
    // convenient time by accident.
    const seen: (Date | undefined)[] = [];
    runDecisionVectors((req) => {
      seen.push(req.now);
      return decide(req);
    });
    for (const now of seen) expect(now?.getTime()).toBe(TEST_NOW * 1000);
  });
});

describe("a failing implementation is caught, not flattered", () => {
  it("fails an implementation that permits everything", () => {
    // The naive failure: something that says yes passes a badly designed suite
    // and is worse than useless in a trust network, because every other
    // participant relies on it to say no.
    const report = runDecisionVectors(() => ({ decision: "permit" }));
    expect(report.conformant).toBe(false);
    expect(report.failed.length).toBeGreaterThan(10);
  });

  it("fails an implementation that denies everything", () => {
    const report = runDecisionVectors(() => ({ decision: "deny", reason: "expired" }));
    expect(report.conformant).toBe(false);
  });

  it("fails an implementation that returns the right decision with the wrong reason", () => {
    const report = runDecisionVectors((req) => {
      const d = decide(req);
      return d.decision === "deny" ? { decision: "deny", reason: "expired" } : d;
    });
    expect(report.conformant).toBe(false);
  });

  it("records a throw as a failure instead of crashing the harness", () => {
    const report = runDecisionVectors(() => {
      throw new Error("boom");
    });
    expect(report.conformant).toBe(false);
    expect(report.failed[0].actual).toContain("threw:boom");
  });

  it("gives no partial credit", () => {
    // One wrong answer in a trust network is one participant honouring
    // something nobody else does.
    const report = runDecisionVectors((req) =>
      req.revocation === "unknown" ? { decision: "permit" } : decide(req),
    );
    expect(report.conformant).toBe(false);
    expect(report.passed).toBe(report.total - 1);
    expect(report.failed[0].id).toBe("deny_revocation_unknown");
  });
});

describe("the published test key cannot become a real one", () => {
  it("uses an issuer under a TLD that cannot resolve", () => {
    // RFC 2606 reserves .invalid precisely so a published fixture can never be
    // fetched from somewhere an attacker controls.
    expect(TEST_ISSUER).toMatch(/\.invalid$/);
  });

  it("has no trust-registry entry, so nothing will fetch its keys", () => {
    expect(resolveIssuerKeysUri(TEST_ISSUER)).toBeNull();
  });

  it("says plainly in the published document that the key is not an issuer key", () => {
    const doc = vectorDocument();
    expect(doc.warning).toMatch(/not an issuer key/i);
    expect(doc.kid).toMatch(/do-not-trust/);
  });
});

describe("the published document is usable from another language", () => {
  it("serialises without loss", () => {
    const doc = vectorDocument();
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });

  it("carries the claim set for each vector, so fixtures can be regenerated", () => {
    for (const v of vectorDocument().vectors) {
      expect(v.claims).toBeDefined();
      expect(v.expect.decision).toMatch(/permit|deny/);
    }
  });

  it("states the revocation state explicitly rather than leaving it implied", () => {
    // The field implementations most often default differently, and the one
    // where defaulting wrong means failing open.
    for (const v of vectorDocument().vectors) {
      expect(["active", "revoked", "unknown"]).toContain(v.revocation);
    }
  });

  it("never publishes a vector expecting a forbidden scope to be permitted", () => {
    for (const v of DECISION_VECTORS) {
      if (FORBIDDEN_SCOPES.includes(v.request.action)) {
        expect(v.expect.decision).toBe("deny");
      }
    }
  });
});

describe("the reference implementations cannot silently fall behind", () => {
  it("has a vector for every globally forbidden act", () => {
    // The failure this prevents, which already happened once: cross-domain
    // prohibitions were added to the TypeScript decision layer and to none of
    // the five reference implementations. They kept passing, because no vector
    // exercised the new rule — so five programs quietly permitted an act the
    // sixth refused, which in a trust network is the worst possible state.
    //
    // A prohibition with no vector is a prohibition only one implementation
    // has. This asserts at least one vector reaches each domain's list, so
    // adding a domain without a vector fails here rather than in production.
    const exercised = new Set(
      DECISION_VECTORS.flatMap((v) => [v.request.action, ...v.request.claims.scopes]),
    );
    for (const domain of DOMAINS) {
      const covered = domain.forbidden.some(
        (f) => exercised.has(f) || exercised.has(`${domain.id}/${f}`),
      );
      expect(covered, `no vector exercises any prohibition from "${domain.id}"`).toBe(true);
    }
  });
});
