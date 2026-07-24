import { describe, it, expect } from "vitest";
import { computePensionFees } from "./pensionFees";

const base = {
  balanceShekels: 200_000,
  monthlyDepositShekels: 2_000,
  years: 30,
  currentDepositFeePct: 2,
  currentBalanceFeePct: 0.3,
  targetDepositFeePct: 1,
  targetBalanceFeePct: 0.1,
  annualReturnPct: 4,
};

describe("computePensionFees", () => {
  it("lower fees leave a materially higher balance at retirement", () => {
    const r = computePensionFees(base);
    expect(r.targetFinalShekels).toBeGreaterThan(r.currentFinalShekels);
    // Over 30 years the fee gap is worth tens of thousands, not pennies.
    expect(r.savingsShekels).toBeGreaterThan(50_000);
  });

  it("identical current and target fees produce zero savings", () => {
    const r = computePensionFees({
      ...base,
      targetDepositFeePct: base.currentDepositFeePct,
      targetBalanceFeePct: base.currentBalanceFeePct,
    });
    expect(r.savingsShekels).toBe(0);
    expect(r.currentFinalShekels).toBe(r.targetFinalShekels);
  });

  it("more years widen the fee gap (compounding)", () => {
    const short = computePensionFees({ ...base, years: 10 });
    const long = computePensionFees({ ...base, years: 35 });
    expect(long.savingsShekels).toBeGreaterThan(short.savingsShekels);
  });

  it("zero years returns the starting balance unchanged and zero savings", () => {
    const r = computePensionFees({ ...base, years: 0 });
    expect(r.currentFinalShekels).toBe(base.balanceShekels);
    expect(r.targetFinalShekels).toBe(base.balanceShekels);
    expect(r.savingsShekels).toBe(0);
  });

  it("clamps nonsensical fee inputs instead of producing garbage", () => {
    const r = computePensionFees({
      ...base,
      currentDepositFeePct: -5,
      currentBalanceFeePct: 999,
    });
    expect(Number.isFinite(r.currentFinalShekels)).toBe(true);
    expect(r.currentFinalShekels).toBeGreaterThanOrEqual(0);
  });

  it("savings never goes negative even if target fees exceed current", () => {
    const r = computePensionFees({
      ...base,
      targetDepositFeePct: 5,
      targetBalanceFeePct: 0.5,
    });
    expect(r.savingsShekels).toBeGreaterThanOrEqual(0);
  });
});
