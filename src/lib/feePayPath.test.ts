import { describe, expect, it } from "vitest";
import { feePayAbsoluteUrl, feePayDashboardPath } from "./feePayPath";

describe("feePayPath", () => {
  it("invents payFee=1 only when Mandate active and payments live", () => {
    expect(
      feePayDashboardPath("he", "case_abc", { mandateActive: true, paymentsLive: true }),
    ).toBe("/he/money?case=case_abc&payFee=1");
    expect(
      feePayAbsoluteUrl("https://zakai.test", "IL", "case_abc", {
        mandateActive: true,
        paymentsLive: true,
      }),
    ).toBe("https://zakai.test/he/money?case=case_abc&payFee=1");
  });

  it("omits payFee when Mandate is inactive", () => {
    expect(
      feePayDashboardPath("he", "case_abc", { mandateActive: false, paymentsLive: true }),
    ).toBe("/he/money?case=case_abc");
  });

  it("omits payFee under mock PSP even with ACTIVE Mandate", () => {
    expect(
      feePayDashboardPath("he", "case_abc", { mandateActive: true, paymentsLive: false }),
    ).toBe("/he/money?case=case_abc");
    expect(
      feePayAbsoluteUrl("https://zakai.test", "IL", "case_abc", {
        mandateActive: true,
        paymentsLive: false,
      }),
    ).toBe("https://zakai.test/he/money?case=case_abc");
  });
});
