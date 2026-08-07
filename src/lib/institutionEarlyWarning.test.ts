import { describe, expect, it } from "vitest";
import {
  MIN_PATTERN_SAMPLE,
  PATTERN_MIN_SHARE,
  buildEarlyWarning,
  worthWarning,
  type ClaimRow,
} from "./institutionEarlyWarning";

const claim = (over: Partial<ClaimRow> = {}): ClaimRow => ({
  cause: "duplicate_fee",
  paid: true,
  recoveredMinor: 5_000,
  days: 10,
  ...over,
});

const many = (n: number, over: Partial<ClaimRow> = {}) =>
  Array.from({ length: n }, () => claim(over));

describe("buildEarlyWarning", () => {
  it("names the fault an institution keeps conceding", () => {
    const w = buildEarlyWarning("bank", many(10));
    expect(w.reason).toBe("ok");
    expect(w.headline?.cause).toBe("duplicate_fee");
    expect(w.headline?.count).toBe(10);
    expect(w.headline?.conceded).toBe(true);
  });

  /**
   * The gate that keeps this from crying wolf. Four complaints is a mix, not a
   * systemic fault, and telling an institution otherwise spends the
   * credibility that makes the next warning land.
   */
  it("says nothing below the sample gate", () => {
    const w = buildEarlyWarning("bank", many(MIN_PATTERN_SAMPLE - 1));
    expect(w.headline).toBeNull();
    expect(w.reason).toBe("too_few_claims");
  });

  it("does not call ordinary complaint mix a pattern", () => {
    // Five causes, one claim each plus filler — no cause dominates.
    const mixed: ClaimRow[] = [
      ...many(4, { cause: "a" }),
      ...many(4, { cause: "b" }),
      ...many(4, { cause: "c" }),
    ];
    const w = buildEarlyWarning("bank", mixed);
    expect(w.headline).toBeNull();
    expect(w.reason).toBe("no_pattern");
  });

  it("requires a real share, not just a count", () => {
    // 6 of 100 clears MIN_PATTERN_SAMPLE but is 6% — not systemic.
    const rows = [...many(6, { cause: "rare" }), ...many(94, { cause: "other" })];
    const w = buildEarlyWarning("bank", rows);
    expect(w.patterns.map((p) => p.cause)).not.toContain("rare");
  });

  it("reports the institution's own concession rate", () => {
    const rows = [...many(7, { paid: true }), ...many(3, { paid: false })];
    const w = buildEarlyWarning("bank", rows);
    expect(w.headline?.paidRate).toBeCloseTo(0.7);
    expect(w.headline?.conceded).toBe(true);
  });

  it("does not call a mostly-disputed cause conceded", () => {
    const rows = [...many(3, { paid: true }), ...many(7, { paid: false })];
    expect(buildEarlyWarning("bank", rows).headline?.conceded).toBe(false);
  });

  it("sums refunds in integer minor units, paid rows only", () => {
    const rows = [
      ...many(5, { paid: true, recoveredMinor: 1_000 }),
      ...many(5, { paid: false, recoveredMinor: 9_999 }),
    ];
    expect(buildEarlyWarning("bank", rows).headline?.refundedMinor).toBe(5_000);
  });

  it("measures resolution time among paid claims only", () => {
    const rows = [
      ...many(5, { paid: true, days: 8 }),
      ...many(5, { paid: false, days: 900 }),
    ];
    expect(buildEarlyWarning("bank", rows).headline?.medianDays).toBe(8);
  });

  it("groups causes regardless of casing and spacing", () => {
    const rows = [...many(5, { cause: "Duplicate_Fee" }), ...many(5, { cause: "duplicate_fee " })];
    const w = buildEarlyWarning("bank", rows);
    expect(w.patterns).toHaveLength(1);
    expect(w.patterns[0].count).toBe(10);
  });

  it("orders patterns by how many people they affected", () => {
    const rows = [...many(20, { cause: "big" }), ...many(10, { cause: "small" })];
    expect(buildEarlyWarning("bank", rows).patterns[0].cause).toBe("big");
  });

  it("is honest and empty with no claims at all", () => {
    const w = buildEarlyWarning("bank", []);
    expect(w.totalClaims).toBe(0);
    expect(w.headline).toBeNull();
    expect(w.reason).toBe("too_few_claims");
  });

  it("keeps the share threshold meaningful", () => {
    expect(PATTERN_MIN_SHARE).toBeGreaterThan(0.1);
    expect(PATTERN_MIN_SHARE).toBeLessThan(1);
  });
});

describe("worthWarning", () => {
  it("is true only when they keep conceding the fault", () => {
    // Their own repeated concession is the evidence that makes this their
    // problem to fix rather than our opinion about it.
    expect(worthWarning(buildEarlyWarning("bank", many(10)))).toBe(true);
  });

  it("is false for a cause they mostly dispute", () => {
    const rows = [...many(2, { paid: true }), ...many(8, { paid: false })];
    expect(worthWarning(buildEarlyWarning("bank", rows))).toBe(false);
  });

  it("is false when there is no pattern at all", () => {
    expect(worthWarning(buildEarlyWarning("bank", []))).toBe(false);
  });
});
