import { describe, expect, it } from "vitest";
import { gradeRows, bestVariant, PARTNER_MIN_TRIALS } from "./intelligence";

const row = (o: Partial<Parameters<typeof gradeRows>[0][number]> = {}) => ({
  paid: false,
  recoveredMinor: null,
  days: null,
  variantId: "standard",
  settlementBacked: false,
  ...o,
});

describe("gradeRows — counts always, rates only above the sample gate", () => {
  it("withholds every rate and average below the gate, but never the counts", () => {
    const rows = [row({ paid: true, recoveredMinor: 50_000, days: 10 }), row()];
    const g = gradeRows(rows, PARTNER_MIN_TRIALS);
    expect(g.trials).toBe(2);
    expect(g.wins).toBe(1);
    expect(g.winRate).toBeNull();
    expect(g.avgRecoveredMinor).toBeNull();
    expect(g.medianDays).toBeNull();
  });

  it("computes rate, mean recovery and median days once the gate is met", () => {
    const rows = [
      row({ paid: true, recoveredMinor: 10_000, days: 5 }),
      row({ paid: true, recoveredMinor: 30_000, days: 10 }),
      row({ paid: true, recoveredMinor: 20_000, days: 20 }),
      row({ paid: false, days: 30 }),
      row({ paid: false, days: 40 }),
    ];
    const g = gradeRows(rows, 5);
    expect(g.trials).toBe(5);
    expect(g.wins).toBe(3);
    expect(g.winRate).toBeCloseTo(0.6);
    expect(g.avgRecoveredMinor).toBe(20_000); // only rows that recovered
    expect(g.medianDays).toBe(20);
  });

  it("reports an all-zero book honestly rather than as an absence", () => {
    const g = gradeRows([], 5);
    expect(g).toEqual({
      trials: 0,
      wins: 0,
      winRate: null,
      avgRecoveredMinor: null,
      medianDays: null,
    });
  });
});

describe("bestVariant", () => {
  it("ignores variants that have not themselves met the gate", () => {
    const rows = [
      // 1 trial, 100% — must not win on a single lucky case
      row({ variantId: "aggressive", paid: true }),
      ...Array.from({ length: 5 }, () => row({ variantId: "standard", paid: true })),
    ];
    expect(bestVariant(rows, 5)).toBe("standard");
  });

  it("returns null when nothing clears the gate", () => {
    expect(bestVariant([row(), row()], 5)).toBeNull();
  });
});
