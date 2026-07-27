import { describe, it, expect } from "vitest";
import { computeMortgageRefi, monthlyPayment } from "./mortgageRefi";

describe("monthlyPayment", () => {
  it("matches the standard amortization formula for a known case", () => {
    // 100,000 at 5% over 10 years (120 months) ≈ 1,060.66/month.
    const p = monthlyPayment(100_000, 5, 120);
    expect(p).toBeGreaterThan(1_055);
    expect(p).toBeLessThan(1_066);
  });

  it("handles a zero interest rate as simple division", () => {
    expect(monthlyPayment(120_000, 0, 120)).toBeCloseTo(1_000, 5);
  });
});

const base = {
  balanceShekels: 800_000,
  currentAnnualRatePct: 5,
  newAnnualRatePct: 4,
  remainingYears: 20,
};

describe("computeMortgageRefi", () => {
  it("a lower rate lowers the monthly payment and saves total interest", () => {
    const r = computeMortgageRefi(base);
    expect(r.newMonthlyShekels).toBeLessThan(r.currentMonthlyShekels);
    expect(r.monthlySavingShekels).toBeGreaterThan(0);
    // A 1-point cut on 800k over 20y is worth tens of thousands in interest.
    expect(r.totalInterestSavedShekels).toBeGreaterThan(50_000);
  });

  it("equal rates produce zero savings", () => {
    const r = computeMortgageRefi({ ...base, newAnnualRatePct: base.currentAnnualRatePct });
    expect(r.monthlySavingShekels).toBe(0);
    expect(r.totalInterestSavedShekels).toBe(0);
  });

  it("never reports negative savings when the 'new' rate is higher", () => {
    const r = computeMortgageRefi({ ...base, newAnnualRatePct: 7 });
    expect(r.monthlySavingShekels).toBeGreaterThanOrEqual(0);
    expect(r.totalInterestSavedShekels).toBeGreaterThanOrEqual(0);
  });

  it("a longer remaining term means more total interest saved from the same cut", () => {
    const short = computeMortgageRefi({ ...base, remainingYears: 5 });
    const long = computeMortgageRefi({ ...base, remainingYears: 25 });
    expect(long.totalInterestSavedShekels).toBeGreaterThan(short.totalInterestSavedShekels);
  });

  it("zero remaining years yields zero payments and zero savings", () => {
    const r = computeMortgageRefi({ ...base, remainingYears: 0 });
    expect(r.currentMonthlyShekels).toBe(0);
    expect(r.monthlySavingShekels).toBe(0);
  });
});
