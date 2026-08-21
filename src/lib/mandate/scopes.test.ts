import { describe, expect, it } from "vitest";
import { SCOPES, FORBIDDEN_SCOPES } from "./scopes";

describe("the bank-feed scope", () => {
  it("exists as its own consent item, not folded into read:transactions", () => {
    // Agreeing that Zakai may see your transactions is not the same fact as
    // agreeing that a licensed third party holds a standing connection to your
    // bank. Burying the second inside the first is the thing scopes exist to
    // prevent.
    const feed = SCOPES.find((s) => s.scope === "read:bank_feed");
    expect(feed).toBeDefined();
    expect(feed!.tier).toBe("read");
  });

  it("says read-only, revocable, and never moves money — in the consent text itself", () => {
    const summary = SCOPES.find((s) => s.scope === "read:bank_feed")!.summary;
    expect(summary).toMatch(/read-only/i);
    expect(summary).toMatch(/revocable/i);
    expect(summary).toMatch(/never used to move money/i);
  });

  it("cannot be confused for permission to move money", () => {
    expect(FORBIDDEN_SCOPES).not.toContain("read:bank_feed");
    for (const forbidden of FORBIDDEN_SCOPES) {
      expect(SCOPES.some((s) => s.scope === forbidden)).toBe(false);
    }
  });
});
