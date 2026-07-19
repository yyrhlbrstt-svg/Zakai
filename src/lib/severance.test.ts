import { describe, it, expect } from "vitest";
import { computeSeverance } from "./severance";

describe("computeSeverance", () => {
  it("gives one month's salary per full year", () => {
    const r = computeSeverance({ lastMonthlyAgorot: 1_000_000, years: 3, months: 0 });
    expect(r.severanceAgorot).toBe(3_000_000);
    expect(r.totalYears).toBe(3);
    expect(r.eligible).toBe(true);
  });

  it("pro-rates partial years by month", () => {
    // 2 years + 6 months = 2.5 × salary.
    const r = computeSeverance({ lastMonthlyAgorot: 800_000, years: 2, months: 6 });
    expect(r.severanceAgorot).toBe(2_000_000);
    expect(r.totalYears).toBeCloseTo(2.5, 5);
  });

  it("is not eligible under one year", () => {
    const r = computeSeverance({ lastMonthlyAgorot: 900_000, years: 0, months: 8 });
    expect(r.eligible).toBe(false);
    // The amount is still computed for orientation.
    expect(r.severanceAgorot).toBe(Math.round((900_000 * 8) / 12));
  });

  it("clamps out-of-range months and negative inputs", () => {
    const r = computeSeverance({ lastMonthlyAgorot: -5, years: -2, months: 20 });
    expect(r.severanceAgorot).toBe(0);
    expect(r.totalYears).toBe(11 / 12);
  });

  it("handles a long tenure exactly", () => {
    const r = computeSeverance({ lastMonthlyAgorot: 1_200_000, years: 10, months: 3 });
    // 10.25 × 12,000 ₪ = 123,000 ₪
    expect(r.severanceAgorot).toBe(Math.round(1_200_000 * (10 + 3 / 12)));
  });
});
