import { describe, expect, it } from "vitest";
import { feePayAbsoluteUrl, feePayDashboardPath } from "./feePayPath";

describe("feePayPath", () => {
  it("builds locale /money pay link when Mandate is active", () => {
    expect(feePayDashboardPath("he", "case_abc")).toBe("/he/money?case=case_abc&payFee=1");
    expect(feePayDashboardPath("he", "case_abc", true)).toBe(
      "/he/money?case=case_abc&payFee=1",
    );
  });

  it("omits payFee when Mandate is inactive", () => {
    expect(feePayDashboardPath("he", "case_abc", false)).toBe("/he/money?case=case_abc");
    expect(feePayAbsoluteUrl("https://zakai.test", "IL", "case_abc", false)).toBe(
      "https://zakai.test/he/money?case=case_abc",
    );
  });
});
