import { describe, it, expect } from "vitest";
import { computePotentialTotal, type PotentialProfile } from "./potentialTotal";

const empty: PotentialProfile = {
  ownsHome: false,
  hasMortgage: false,
  hasPension: false,
  employed: false,
  hasPrivateInsurance: false,
  flewDelayed: false,
  rents: false,
};

describe("computePotentialTotal", () => {
  it("everyone gets the universal lost-money item even with no answers", () => {
    const r = computePotentialTotal(empty);
    expect(r.items.some((i) => i.key === "lostmoney")).toBe(true);
    expect(r.totalHighShekels).toBeGreaterThan(0);
  });

  it("more true answers never lower the total (monotonic)", () => {
    const some = computePotentialTotal({ ...empty, employed: true });
    const more = computePotentialTotal({ ...empty, employed: true, hasMortgage: true });
    expect(more.totalHighShekels).toBeGreaterThanOrEqual(some.totalHighShekels);
    expect(more.items.length).toBeGreaterThanOrEqual(some.items.length);
  });

  it("high potential items sort before low ones", () => {
    const r = computePotentialTotal({ ...empty, hasPension: true, employed: true });
    for (let i = 1; i < r.items.length; i++) {
      expect(r.items[i - 1].highShekels).toBeGreaterThanOrEqual(r.items[i].highShekels);
    }
  });

  it("the low total never exceeds the high total", () => {
    const r = computePotentialTotal({
      ownsHome: true,
      hasMortgage: true,
      hasPension: true,
      employed: true,
      hasPrivateInsurance: true,
      flewDelayed: true,
      rents: false,
    });
    expect(r.totalLowShekels).toBeLessThanOrEqual(r.totalHighShekels);
    // A fully-loaded profile surfaces the big-ticket items.
    expect(r.items.some((i) => i.key === "pension")).toBe(true);
    expect(r.items.some((i) => i.key === "mortgage")).toBe(true);
  });

  it("employed adds both tax-refund and payslip checks", () => {
    const r = computePotentialTotal({ ...empty, employed: true });
    const keys = r.items.map((i) => i.key);
    expect(keys).toContain("taxrefund");
    expect(keys).toContain("payslip");
  });
});
