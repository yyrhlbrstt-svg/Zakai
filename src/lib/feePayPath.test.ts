import { describe, expect, it } from "vitest";
import { feePayDashboardPath } from "./feePayPath";

describe("feePayPath", () => {
  it("builds locale dashboard pay link", () => {
    expect(feePayDashboardPath("he", "case_abc")).toBe("/he/dashboard?case=case_abc&payFee=1");
  });
});
