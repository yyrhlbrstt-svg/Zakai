import { describe, it, expect } from "vitest";
import { computeFee, monthlySaving, FEE_RATE_BPS } from "./fee";
import { shekelsToAgorot } from "./money";

describe("monthlySaving", () => {
  it("is the positive difference in agorot", () => {
    expect(monthlySaving(10000, 7000)).toBe(3000);
  });

  it("clamps to zero when the new amount is higher (no negative saving)", () => {
    expect(monthlySaving(7000, 10000)).toBe(0);
  });

  it("is zero when nothing changed", () => {
    expect(monthlySaving(10000, 10000)).toBe(0);
  });

  it("rejects non-integer agorot", () => {
    expect(() => monthlySaving(100.5, 50)).toThrow();
  });

  it("rejects negative inputs", () => {
    expect(() => monthlySaving(-1, 0)).toThrow();
  });
});

describe("computeFee — the money-critical path", () => {
  it("charges 18% of a documented saving", () => {
    // 100 ₪ -> 70 ₪ = 30 ₪ saving; fee = 18% = 5.40 ₪ = 540 agorot
    const fee = computeFee(shekelsToAgorot(100), shekelsToAgorot(70));
    expect(fee.savingMonthly).toBe(3000);
    expect(fee.amount).toBe(540);
    expect(fee.rateBps).toBe(FEE_RATE_BPS);
    expect(fee.chargeable).toBe(true);
  });

  it("charges nothing when there is no saving", () => {
    const fee = computeFee(shekelsToAgorot(70), shekelsToAgorot(70));
    expect(fee.savingMonthly).toBe(0);
    expect(fee.amount).toBe(0);
    expect(fee.chargeable).toBe(false);
  });

  it("charges nothing when the bill went up (never a negative charge)", () => {
    const fee = computeFee(shekelsToAgorot(70), shekelsToAgorot(120));
    expect(fee.amount).toBe(0);
    expect(fee.chargeable).toBe(false);
  });

  it("rounds a fractional-agora fee half-up", () => {
    // saving 37 ₪ = 3700 agorot; 18% = 666 agorot exactly (6.66 ₪)
    expect(computeFee(shekelsToAgorot(37), 0).amount).toBe(666);
    // saving 3701 agorot; 18% = 666.18 -> 666
    expect(computeFee(3701, 0).amount).toBe(666);
    // saving 3703 agorot; 18% = 666.54 -> 667
    expect(computeFee(3703, 0).amount).toBe(667);
  });

  it("treats a sub-1-agora fee as not chargeable", () => {
    // saving of 5 agorot; 18% = 0.9 -> rounds to 1 agora, chargeable
    expect(computeFee(5, 0).amount).toBe(1);
    // saving of 2 agorot; 18% = 0.36 -> rounds to 0, not chargeable
    const tiny = computeFee(2, 0);
    expect(tiny.amount).toBe(0);
    expect(tiny.chargeable).toBe(false);
  });

  it("honors an injected rate for future plans", () => {
    // 20% of 30 ₪ = 6 ₪
    expect(computeFee(shekelsToAgorot(100), shekelsToAgorot(70), 2000).amount).toBe(600);
  });

  it("rejects an invalid rate", () => {
    expect(() => computeFee(1000, 0, -1)).toThrow();
    expect(() => computeFee(1000, 0, 1.5)).toThrow();
  });
});
