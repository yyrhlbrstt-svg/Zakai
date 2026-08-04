import { describe, it, expect, afterEach } from "vitest";
import {
  paymentProvider,
  paymentProviderName,
  payplusKeysComplete,
  realPaymentsConfigured,
  PaymentUnavailableError,
} from "./index";

const ORIG = process.env.PAYMENT_PROVIDER;
const ORIG_FORCE = process.env.FORCE_MOCK_PAYMENTS;
const ORIG_KEYS = {
  PAYPLUS_API_KEY: process.env.PAYPLUS_API_KEY,
  PAYPLUS_SECRET_KEY: process.env.PAYPLUS_SECRET_KEY,
  PAYPLUS_PAYMENT_PAGE_UID: process.env.PAYPLUS_PAYMENT_PAGE_UID,
};

function clearPayplusKeys() {
  delete process.env.PAYPLUS_API_KEY;
  delete process.env.PAYPLUS_SECRET_KEY;
  delete process.env.PAYPLUS_PAYMENT_PAGE_UID;
}

function restorePayplusKeys() {
  for (const [k, v] of Object.entries(ORIG_KEYS)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

afterEach(() => {
  if (ORIG === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = ORIG;
  if (ORIG_FORCE === undefined) delete process.env.FORCE_MOCK_PAYMENTS;
  else process.env.FORCE_MOCK_PAYMENTS = ORIG_FORCE;
  restorePayplusKeys();
});

describe("payment provider selection", () => {
  it("defaults to the mock provider when nothing is configured", () => {
    delete process.env.PAYMENT_PROVIDER;
    delete process.env.FORCE_MOCK_PAYMENTS;
    clearPayplusKeys();
    expect(paymentProviderName()).toBe("mock");
    expect(realPaymentsConfigured()).toBe(false);
    expect(paymentProvider().name).toBe("mock");
  });

  it("reports a real provider as configured", () => {
    process.env.PAYMENT_PROVIDER = "payplus";
    expect(realPaymentsConfigured()).toBe(true);
    expect(paymentProvider().name).toBe("payplus");
  });

  it("auto-heals mock/unset to PayPlus when all keys are present", () => {
    delete process.env.FORCE_MOCK_PAYMENTS;
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.PAYPLUS_API_KEY = "k";
    process.env.PAYPLUS_SECRET_KEY = "s";
    process.env.PAYPLUS_PAYMENT_PAGE_UID = "page";
    expect(payplusKeysComplete()).toBe(true);
    expect(paymentProviderName()).toBe("payplus");
    expect(paymentProvider().name).toBe("payplus");
  });

  it("keeps mock when FORCE_MOCK_PAYMENTS=true even with keys", () => {
    process.env.FORCE_MOCK_PAYMENTS = "true";
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.PAYPLUS_API_KEY = "k";
    process.env.PAYPLUS_SECRET_KEY = "s";
    process.env.PAYPLUS_PAYMENT_PAGE_UID = "page";
    expect(paymentProviderName()).toBe("mock");
    expect(paymentProvider().name).toBe("mock");
  });
});

describe("mock checkout", () => {
  it("returns a checkout URL carrying the fee id + a reference", async () => {
    delete process.env.PAYMENT_PROVIDER;
    process.env.FORCE_MOCK_PAYMENTS = "true";
    clearPayplusKeys();
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

  it("splits browser success/failure return URLs while keeping feeId", async () => {
    process.env.PAYMENT_PROVIDER = "payplus";
    process.env.PAYPLUS_API_KEY = "k";
    process.env.PAYPLUS_SECRET_KEY = "s";
    process.env.PAYPLUS_PAYMENT_PAGE_UID = "page";
    const origFetch = globalThis.fetch;
    let posted: unknown;
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      posted = JSON.parse(String(init?.body ?? "{}"));
      return new Response(
        JSON.stringify({
          results: { status: "success" },
          data: {
            payment_page_link: "https://payplus.example/pay",
            page_request_uid: "req_1",
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      await paymentProvider().createCheckout({
        feeId: "fee_abc",
        amountAgorot: 1800,
        description: "fee",
        returnUrl: "https://zakai.example/api/payments/callback?loc=he&feeId=fee_abc",
      });
      const body = posted as {
        refURL_success: string;
        refURL_failure: string;
        refURL_callback: string;
      };
      expect(new URL(body.refURL_success).searchParams.get("outcome")).toBe("success");
      expect(new URL(body.refURL_success).searchParams.get("feeId")).toBe("fee_abc");
      expect(new URL(body.refURL_failure).searchParams.get("outcome")).toBe("failure");
      expect(new URL(body.refURL_callback).searchParams.get("outcome")).toBeNull();
      expect(new URL(body.refURL_callback).searchParams.get("feeId")).toBe("fee_abc");
    } finally {
      globalThis.fetch = origFetch;
      delete process.env.PAYPLUS_API_KEY;
      delete process.env.PAYPLUS_SECRET_KEY;
      delete process.env.PAYPLUS_PAYMENT_PAGE_UID;
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
