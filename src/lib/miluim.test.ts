import { describe, it, expect } from "vitest";
import { computeMiluim } from "./miluim";

describe("computeMiluim", () => {
  it("employee: 3-month gross ÷ 90 per day, plus the 20% supplement", () => {
    // ₪36,000 over 3 months → ₪400/day; 10 days → ₪4,000 + 20% = ₪4,800.
    const r = computeMiluim({ employment: "employee", threeMonthAgorot: 3_600_000, serviceDays: 10 });
    expect(r.dailyAgorot).toBe(40_000);
    expect(r.baseAgorot).toBe(400_000);
    expect(r.supplementAgorot).toBe(80_000);
    expect(r.totalAgorot).toBe(480_000);
  });

  it("self-employed: insured income grossed up 25% before the ÷90", () => {
    // ₪36,000 × 1.25 = ₪45,000 → ₪500/day; 6 days → ₪3,000 + ₪600.
    const r = computeMiluim({ employment: "self_employed", threeMonthAgorot: 3_600_000, serviceDays: 6 });
    expect(r.dailyAgorot).toBe(50_000);
    expect(r.totalAgorot).toBe(360_000);
  });

  it("clamps zero/negative inputs", () => {
    const r = computeMiluim({ employment: "employee", threeMonthAgorot: -5, serviceDays: -3 });
    expect(r.totalAgorot).toBe(0);
  });

  it("supplement is exactly 20% of the base", () => {
    const r = computeMiluim({ employment: "employee", threeMonthAgorot: 2_700_000, serviceDays: 21 });
    expect(r.supplementAgorot).toBe(Math.round(r.baseAgorot * 0.2));
  });
});
