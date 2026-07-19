import { describe, it, expect } from "vitest";
import {
  annualTaxAgorot,
  estimatePartialYearRefund,
  CREDIT_POINT_ANNUAL_AGOROT,
} from "./tax";

describe("annualTaxAgorot", () => {
  it("taxes within the first bracket at 10%", () => {
    expect(annualTaxAgorot(5_000_000)).toBe(500_000); // ₪50,000 → ₪5,000
  });

  it("applies brackets progressively", () => {
    // ₪120,000: 84,120@10% + 35,880@14% = 8,412 + 5,023.2 = 13,435.2 ₪
    expect(annualTaxAgorot(12_000_000)).toBe(Math.round(8_412_000 * 0.1 + (12_000_000 - 8_412_000) * 0.14));
  });

  it("is zero at zero income", () => {
    expect(annualTaxAgorot(0)).toBe(0);
  });
});

describe("estimatePartialYearRefund", () => {
  it("returns ~no refund for a full year", () => {
    const r = estimatePartialYearRefund({ monthlyAgorot: 1_000_000, monthsWorked: 12 });
    expect(r.refundAgorot).toBeLessThanOrEqual(1); // rounding only
  });

  it("finds a refund when only part of the year was worked", () => {
    const r = estimatePartialYearRefund({ monthlyAgorot: 1_000_000, monthsWorked: 3 });
    expect(r.refundAgorot).toBeGreaterThan(0);
    // Withheld over 3 months should exceed the (near-zero) actual annual due.
    expect(r.withheldAgorot).toBeGreaterThan(r.actualDueAgorot);
  });

  it("gives no refund at zero income", () => {
    const r = estimatePartialYearRefund({ monthlyAgorot: 0, monthsWorked: 5 });
    expect(r.refundAgorot).toBe(0);
  });

  it("a low part-year income owes nothing (full credit points wipe it)", () => {
    // ₪6,000 × 4 months = ₪24,000 annual → tax ₪2,400 < 2.25pt credit (₪6,534)
    const r = estimatePartialYearRefund({ monthlyAgorot: 600_000, monthsWorked: 4 });
    expect(r.actualDueAgorot).toBe(0);
    expect(annualTaxAgorot(2_400_000)).toBeLessThan(2.25 * CREDIT_POINT_ANNUAL_AGOROT);
  });

  it("shrinks to zero as the year fills up", () => {
    // The over-withholding unwinds as months approach a full year.
    const eight = estimatePartialYearRefund({ monthlyAgorot: 1_200_000, monthsWorked: 8 });
    const twelve = estimatePartialYearRefund({ monthlyAgorot: 1_200_000, monthsWorked: 12 });
    expect(eight.refundAgorot).toBeGreaterThan(twelve.refundAgorot);
    expect(twelve.refundAgorot).toBeLessThanOrEqual(1);
  });
});
