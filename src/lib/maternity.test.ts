import { describe, it, expect } from "vitest";
import {
  computeMaternity,
  MATERNITY_DAILY_CAP_AGOROT,
  MATERNITY_FULL_DAYS,
  MATERNITY_PARTIAL_DAYS,
} from "./maternity";

describe("computeMaternity", () => {
  it("computes the full 105-day benefit from monthly salary / 30", () => {
    const r = computeMaternity({ monthlyAgorot: 1_500_000, eligibility: "full" }); // ₪15,000
    expect(r.dailyAgorot).toBe(50_000); // ₪500/day
    expect(r.days).toBe(MATERNITY_FULL_DAYS);
    expect(r.totalAgorot).toBe(50_000 * 105);
    expect(r.capped).toBe(false);
  });

  it("uses 56 days for partial eligibility", () => {
    const r = computeMaternity({ monthlyAgorot: 900_000, eligibility: "partial" });
    expect(r.days).toBe(MATERNITY_PARTIAL_DAYS);
    expect(r.totalAgorot).toBe(30_000 * 56);
  });

  it("caps the daily wage at the statutory maximum", () => {
    const r = computeMaternity({ monthlyAgorot: 6_000_000, eligibility: "full" }); // ₪60,000
    expect(r.capped).toBe(true);
    expect(r.dailyAgorot).toBe(MATERNITY_DAILY_CAP_AGOROT);
    expect(r.totalAgorot).toBe(MATERNITY_DAILY_CAP_AGOROT * 105);
  });

  it("does not cap a salary right at the ceiling", () => {
    // ₪51,900/mo → daily 1,730 < cap 1,730.33
    const r = computeMaternity({ monthlyAgorot: 5_190_000, eligibility: "full" });
    expect(r.capped).toBe(false);
  });

  it("handles zero and negative input", () => {
    const r = computeMaternity({ monthlyAgorot: -100, eligibility: "full" });
    expect(r.dailyAgorot).toBe(0);
    expect(r.totalAgorot).toBe(0);
  });
});
