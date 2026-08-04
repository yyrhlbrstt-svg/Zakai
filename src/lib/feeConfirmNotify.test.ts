import { describe, expect, it } from "vitest";
import {
  feeConfirmAbsoluteUrl,
  feeConfirmAutoCheckout,
  feeConfirmDashboardPath,
  feeConfirmationBody,
} from "./feeConfirmNotify";

describe("feeConfirmAutoCheckout", () => {
  it("requires ACTIVE Mandate and live PSP", () => {
    expect(feeConfirmAutoCheckout({ mandateActive: true, paymentsLive: true })).toBe(true);
    expect(feeConfirmAutoCheckout({ mandateActive: true, paymentsLive: false })).toBe(false);
    expect(feeConfirmAutoCheckout({ mandateActive: false, paymentsLive: true })).toBe(false);
  });
});

describe("feeConfirm pay links", () => {
  it("invents payFee=1 only when Mandate active and payments live", () => {
    expect(
      feeConfirmDashboardPath("he", "case_abc", { mandateActive: true, paymentsLive: true }),
    ).toBe("/he/money?case=case_abc&payFee=1");
    expect(
      feeConfirmDashboardPath("he", "case_abc", { mandateActive: true, paymentsLive: false }),
    ).toBe("/he/money?case=case_abc");
    expect(
      feeConfirmAbsoluteUrl("https://zakai.test", "IL", "case_abc", {
        mandateActive: false,
        paymentsLive: true,
      }),
    ).toBe("https://zakai.test/he/money?case=case_abc");
  });
});

describe("feeConfirmationBody", () => {
  const base = {
    name: "ישראל",
    provider: "cellcom",
    originalAgorot: 10000,
    newAgorot: 7000,
    savingAgorot: 3000,
    rateBps: 1800,
    grossFeeAgorot: 540,
    creditAgorot: 0,
    netFeeAgorot: 540,
    payUrl: "https://zakai.test/he/money?case=c1",
  };

  it("claims secure one-tap pay only when payments are live", () => {
    const live = feeConfirmationBody({ ...base, paymentsLive: true });
    expect(live).toContain("לתשלום עמלת ההצלחה (חד-פעמי, מאובטח)");
    expect(live).toContain(base.payUrl);
    expect(live).not.toContain("אין גבייה חיה");
  });

  it("never invents מאובטח under mock / half-configured PSP", () => {
    const demo = feeConfirmationBody({ ...base, paymentsLive: false });
    expect(demo).toContain("אין גבייה חיה עדיין");
    expect(demo).not.toContain("מאובטח");
    expect(demo).toContain(base.payUrl);
  });
});
