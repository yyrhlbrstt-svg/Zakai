import { describe, expect, it } from "vitest";
import { SCOPES, FORBIDDEN_SCOPES, type RiskTier } from "./scopes";

/**
 * A Mandate can never move the principal's money outward.
 *
 * This is the single property that makes the whole design acceptable to a
 * regulated institution, and the reason a compromised Mandate is a nuisance
 * rather than a theft: an agent that cannot spend is a categorically
 * different risk object from one that can. Everything else here — the
 * signatures, the revocation list, the per-act confirmation — is protection
 * against misuse. This is protection against the misuse being worth
 * attempting.
 *
 * WHY THE EXISTING TESTS WERE NOT ENOUGH
 *
 * `conformance` and `decision` both check that the scopes named in
 * FORBIDDEN_SCOPES are rejected. That verifies a list, not a property.
 * Nothing stopped somebody adding `payment:send` or `transfer:execute` to
 * SCOPES next week: it would not be in the forbidden list, so every existing
 * test would pass while the guarantee quietly stopped being true.
 *
 * So this asserts the shape of the vocabulary rather than its contents. A new
 * scope whose verb means spending fails here even though no list mentions it.
 */

/**
 * Words that mean money leaving the principal.
 *
 * Matched as whole segments of `action:object`, never as substrings: a
 * substring search calls `read:payroll` a payment because "payroll" contains
 * "pay", which is both wrong and the kind of wrong that gets a guard deleted.
 *
 * `charge` is absent on purpose. In this vocabulary it appears as
 * `dispute:charge`, which is the opposite of spending — it is how money comes
 * back. A scope that actually charged somebody would read `charge:create`,
 * and `create` is not what makes that dangerous; the tier is.
 */
const OUTWARD_MONEY = [
  "pay",
  "payment",
  "payments",
  "transfer",
  "send",
  "withdraw",
  "debit",
  "spend",
  "purchase",
  "buy",
  "trade",
  "invest",
  "borrow",
  "loan",
  "wire",
  "remit",
];

/**
 * The tiers a grantable scope may carry. `inbound_funds` is deliberately
 * present and deliberately named: money moving *toward* the consumer is the
 * entire point of the product. There is no outbound counterpart and adding
 * one has to be a visible act, not a field edit.
 */
const ALLOWED_TIERS: readonly RiskTier[] = ["read", "correspond", "commercial", "inbound_funds"];

describe("no Mandate scope can move money outward", () => {
  it.each(SCOPES.map((s) => [s.scope, s] as const))(
    "%s does not name a spending verb",
    (scope, def) => {
      // A `read` scope cannot move money whatever it is called — that is what
      // the tier means, and it is checked separately below.
      if (def.tier === "read") return;

      const segments = scope.toLowerCase().split(/[:._-]/);
      const hit = segments.find((seg) => OUTWARD_MONEY.includes(seg));
      expect(
        hit,
        `"${scope}" names money leaving the principal ("${hit}"). The product's central safety ` +
          "claim is that a Mandate cannot spend; a scope like this makes that claim false " +
          "regardless of what FORBIDDEN_SCOPES happens to list.",
      ).toBeUndefined();
    },
  );

  it("every scope carries a known risk tier", () => {
    // A scope with an unrecognised tier is one nothing downstream knows how to
    // weigh, and "unweighed" tends to mean "allowed".
    for (const s of SCOPES) {
      expect(ALLOWED_TIERS, `${s.scope} has tier "${s.tier}"`).toContain(s.tier);
    }
  });

  it("has no outbound counterpart to inbound_funds", () => {
    // The asymmetry is the design. If an "outbound_funds" tier ever appears,
    // this fails and somebody has to argue for it out loud.
    const tiers = new Set(SCOPES.map((s) => s.tier as string));
    for (const t of tiers) {
      expect(/out|debit|send|pay/.test(t), `tier "${t}" describes money leaving`).toBe(false);
    }
  });

  it("keeps the explicitly forbidden scopes out of the grantable set", () => {
    const grantable = new Set(SCOPES.map((s) => s.scope));
    for (const forbidden of FORBIDDEN_SCOPES) {
      expect(grantable.has(forbidden), `${forbidden} is both forbidden and grantable`).toBe(false);
    }
  });

  it("checks a real vocabulary, so it cannot pass by measuring nothing", () => {
    expect(SCOPES.length).toBeGreaterThan(5);
    expect(FORBIDDEN_SCOPES.length).toBeGreaterThan(3);
  });
});
