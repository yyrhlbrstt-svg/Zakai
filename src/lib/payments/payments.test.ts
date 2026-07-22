import { describe, it, expect, afterEach } from "vitest";
import {
  paymentProvider,
  paymentProviderName,
  realPaymentsConfigured,
  PaymentUnavailableError,
} from "./index";

const ORIG = process.env.PAYMENT_PROVIDER;
afterEach(() => {
  if (ORIG === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = ORIG;
});

describe("payment provider selection", () => {
  it("defaults to the mock provider when nothing is configured", () => {
    delete process.env.PAYMENT_PROVIDER;
    expect(paymentProviderName()).toBe("mock");
    expect(realPaymentsConfigured()).toBe(false);
    expect(paymentProvider().name).toBe("mock");
  });

  it("reports a real provider as configured", () => {
    process.env.PAYMENT_PROVIDER = "payplus";
    expect(realPaymentsConfigured()).toBe(true);
    expect(paymentProvider().name).toBe("payplus");
  });
});

describe("mock checkout", () => {
  it("returns a checkout URL carrying the fee id + a reference", async () => {
    delete process.env.PAYMENT_PROVIDER;
    const res = await paymentProvider().createCheckout({
      feeId: "fee_123",
      amountAgorot: 5000,
      description: "test",
      returnUrl: "https://zakai.example/api/payments/callback",
    });
    const url = new URL(res.checkoutUrl);
    expect(url.searchParams.get("feeId")).toBe("fee_123");
    expect(url.searchParams.get("ref")).toBe(res.providerRef);
    expect(res.providerRef).toContain("fee_123");
  });
});

describe("unconfigured real provider", () => {
  it("throws PaymentUnavailableError until its adapter is implemented", async () => {
    process.env.PAYMENT_PROVIDER = "tranzila";
    await expect(
      paymentProvider().createCheckout({
        feeId: "f",
        amountAgorot: 1,
        description: "d",
        returnUrl: "https://x/y",
      }),
    ).rejects.toBeInstanceOf(PaymentUnavailableError);
  });
});
