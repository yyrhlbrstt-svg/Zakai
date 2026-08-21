import { describe, expect, it } from "vitest";
import { gateScanCharges } from "./scanClaims";
import { CLAIM_SPEAK_THRESHOLD } from "./claimGate";
import type { RecurringCharge } from "./subscriptions";

const charge = (merchant: string, monthlyAgorot: number, confidence: number): RecurringCharge => ({
  merchant,
  category: "other",
  monthlyAgorot,
  occurrences: 3,
  providerKey: null,
  confidence,
  chargedOn: [],
});

describe("the claim gate over a statement scan", () => {
  it("keeps every row in sight and only filters what we assert about", () => {
    const rows = [charge("gym", 20_000, 0.95), charge("maybe", 9_900, 0.4)];
    const { claimable, heldBack } = gateScanCharges(rows);
    expect(claimable.map((c) => c.merchant)).toEqual(["gym"]);
    // Not dropped — shown, just not claimed about.
    expect(heldBack.map((c) => c.merchant)).toEqual(["maybe"]);
    expect(claimable.length + heldBack.length).toBe(rows.length);
  });

  it("never claims about a charge below the bar, however large it is", () => {
    // The expensive mistake is telling somebody confidently about ₪400 a month
    // that is not actually a subscription. Size must not buy its way in.
    const { claimable } = gateScanCharges([charge("big but unsure", 40_000, CLAIM_SPEAK_THRESHOLD - 0.01)]);
    expect(claimable).toEqual([]);
  });

  it("orders claims by money so the first thing offered is the best one", () => {
    const { claimable } = gateScanCharges([
      charge("small", 3_000, 0.9),
      charge("large", 30_000, 0.9),
      charge("middle", 12_000, 0.9),
    ]);
    expect(claimable.map((c) => c.merchant)).toEqual(["large", "middle", "small"]);
  });

  it("says nothing at all when nothing clears the bar", () => {
    const { claimable, heldBack, verdicts } = gateScanCharges([
      charge("a", 5_000, 0.3),
      charge("b", 5_000, 0.65),
    ]);
    expect(claimable).toEqual([]);
    expect(heldBack).toHaveLength(2);
    expect(verdicts.every((v) => !v.speak)).toBe(true);
  });

  it("counts the silenced ones rather than losing them", () => {
    const { verdicts } = gateScanCharges([charge("a", 1, 0.1), charge("b", 1, 0.99)]);
    expect(verdicts).toHaveLength(2);
    expect(verdicts.filter((v) => v.speak)).toHaveLength(1);
  });
});
