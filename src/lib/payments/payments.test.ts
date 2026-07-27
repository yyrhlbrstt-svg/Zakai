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

describe("payplus adapter", () => {
  it("refuses to create a checkout until its API keys are configured", async () => {
    process.env.PAYMENT_PROVIDER = "payplus";
    const savedKey = process.env.PAYPLUS_API_KEY;
    delete process.env.PAYPLUS_API_KEY;
    try {
      await expect(
        paymentProvider().createCheckout({
          feeId: "f",
          amountAgorot: 5000,
          description: "d",
          returnUrl: "https://x/y",
        }),
      ).rejects.toBeInstanceOf(PaymentUnavailableError);
    } finally {
      if (savedKey !== undefined) process.env.PAYPLUS_API_KEY = savedKey;
    }
  });
});

describe("verifyCallback (fail-closed money path)", () => {
  const ctx = (over: Partial<import("./index").CallbackContext> = {}) => ({
    method: "POST" as const,
    query: {},
    body: {},
    rawBody: "",
    headers: {},
    ...over,
  });

  it("mock trusts params (its ref is the secret confirmFeePayment matches)", async () => {
    delete process.env.PAYMENT_PROVIDER;
    const v = await paymentProvider().verifyCallback(
      ctx({ query: { feeId: "f1", ref: "mock_secret" } }),
    );
    expect(v).toEqual({ feeId: "f1", providerRef: "mock_secret" });
  });

  it("mock rejects when params are missing", async () => {
    delete process.env.PAYMENT_PROVIDER;
    expect(await paymentProvider().verifyCallback(ctx())).toBeNull();
  });

  it("payplus fails closed on an unsigned / forged callback", async () => {
    process.env.PAYMENT_PROVIDER = "payplus";
    process.env.PAYPLUS_SECRET_KEY = "test_secret";
    // No valid hash header → must NOT confirm.
    const forged = await paymentProvider().verifyCallback(
      ctx({
        rawBody: JSON.stringify({ more_info: "f1", page_request_uid: "r1", transaction: { status_code: "000" } }),
        headers: { hash: "not-the-real-hmac" },
      }),
    );
    expect(forged).toBeNull();
    // A browser GET (no signature) can never confirm a real payment either.
    const viaGet = await paymentProvider().verifyCallback(
      ctx({ method: "GET", query: { feeId: "f1", ref: "r1" } }),
    );
    expect(viaGet).toBeNull();
    delete process.env.PAYPLUS_SECRET_KEY;
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
