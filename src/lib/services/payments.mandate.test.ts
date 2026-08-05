import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findUnique = vi.fn();
const feeFindUnique = vi.fn();
const feeUpdate = vi.fn();
const feeUpdateMany = vi.fn();
const createCheckout = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: { findFirst: (...args: unknown[]) => findFirst(...args) },
    authorization: { findUnique: (...args: unknown[]) => findUnique(...args) },
    fee: {
      findUnique: (...args: unknown[]) => feeFindUnique(...args),
      update: (...args: unknown[]) => feeUpdate(...args),
      updateMany: (...args: unknown[]) => feeUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/payments", () => ({
  paymentProvider: () => ({ createCheckout: (...args: unknown[]) => createCheckout(...args) }),
  paymentProviderName: () => "mock",
}));

import { initiateFeePayment, confirmFeePayment, PaymentError } from "./payments";

describe("initiateFeePayment mandate binding", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findUnique.mockReset();
    feeUpdate.mockReset();
    feeUpdateMany.mockReset();
    createCheckout.mockReset();
    createCheckout.mockResolvedValue({
      checkoutUrl: "https://pay.example/checkout",
      providerRef: "ref-1",
    });
    feeUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("refuses when PENDING fee and Authorization both lack mandateJti", async () => {
    findFirst.mockResolvedValue({
      id: "c1",
      fee: { id: "f1", status: "PENDING", amount: 1800, mandateJti: null },
    });
    findUnique.mockResolvedValue({ mandateJti: null, status: "ACTIVE" });
    await expect(
      initiateFeePayment("c1", "u1", "https://zakai.test", "he"),
    ).rejects.toMatchObject({ message: "MANDATE_REQUIRED" });
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("heals Fee.mandateJti from ACTIVE Authorization before checkout", async () => {
    findFirst.mockResolvedValue({
      id: "c1",
      fee: { id: "f1", status: "PENDING", amount: 1800, mandateJti: null },
    });
    findUnique.mockResolvedValue({ mandateJti: "jti-from-auth", status: "ACTIVE" });
    feeUpdate
      .mockResolvedValueOnce({
        id: "f1",
        status: "PENDING",
        amount: 1800,
        mandateJti: "jti-from-auth",
      })
      .mockResolvedValueOnce({ id: "f1" });

    const result = await initiateFeePayment("c1", "u1", "https://zakai.test", "he");
    expect(result.checkoutUrl).toBe("https://pay.example/checkout");
    expect(feeUpdate).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { mandateJti: "jti-from-auth" },
    });
    expect(createCheckout).toHaveBeenCalled();
  });

  it("does not heal from REVOKED Authorization", async () => {
    findFirst.mockResolvedValue({
      id: "c1",
      fee: { id: "f1", status: "PENDING", amount: 1800, mandateJti: null },
    });
    findUnique.mockResolvedValue({ mandateJti: "jti-old", status: "REVOKED" });
    await expect(
      initiateFeePayment("c1", "u1", "https://zakai.test", "he"),
    ).rejects.toThrow("MANDATE_REQUIRED");
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("refuses checkout when Fee.mandateJti is set but Authorization is REVOKED", async () => {
    findFirst.mockResolvedValue({
      id: "c1",
      fee: { id: "f1", status: "PENDING", amount: 1800, mandateJti: "jti-bound" },
    });
    findUnique.mockResolvedValue({ mandateJti: "jti-bound", status: "REVOKED" });
    await expect(
      initiateFeePayment("c1", "u1", "https://zakai.test", "he"),
    ).rejects.toThrow("MANDATE_REQUIRED");
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("refuses when Fee.mandateJti does not match the ACTIVE Authorization jti", async () => {
    findFirst.mockResolvedValue({
      id: "c1",
      fee: { id: "f1", status: "PENDING", amount: 1800, mandateJti: "jti-old" },
    });
    findUnique.mockResolvedValue({ mandateJti: "jti-new", status: "ACTIVE" });
    await expect(
      initiateFeePayment("c1", "u1", "https://zakai.test", "he"),
    ).rejects.toThrow("MANDATE_REQUIRED");
    expect(createCheckout).not.toHaveBeenCalled();
  });

  it("allows checkout when Fee.mandateJti matches ACTIVE Authorization", async () => {
    findFirst.mockResolvedValue({
      id: "c1",
      fee: { id: "f1", status: "PENDING", amount: 1800, mandateJti: "jti-live" },
    });
    findUnique.mockResolvedValue({ mandateJti: "jti-live", status: "ACTIVE" });
    feeUpdate.mockResolvedValue({ id: "f1" });
    const result = await initiateFeePayment("c1", "u1", "https://zakai.test", "he");
    expect(result.checkoutUrl).toBe("https://pay.example/checkout");
    expect(createCheckout).toHaveBeenCalled();
  });
});

describe("initiateFeePayment — claim before calling the PSP", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findUnique.mockReset();
    feeUpdate.mockReset();
    feeUpdateMany.mockReset();
    createCheckout.mockReset();
    createCheckout.mockResolvedValue({
      checkoutUrl: "https://pay.example/checkout",
      providerRef: "ref-1",
    });
  });

  it(
    "never calls the PSP when a concurrent request already claimed the fee — " +
      "the bug this guards against: two overlapping requests (double-click 'pay now', " +
      "or the same fee open in two tabs) both mint a real, independently-payable " +
      "checkout link, and the second write silently overwrites the first's providerRef, " +
      "orphaning any payment made against the link that lost the race",
    async () => {
      findFirst.mockResolvedValue({
        id: "c1",
        fee: { id: "f1", status: "PENDING", amount: 1800, mandateJti: "jti-live", providerRef: null },
      });
      findUnique.mockResolvedValue({ mandateJti: "jti-live", status: "ACTIVE" });
      // Simulates another request's updateMany having already claimed this fee
      // between our read and our own claim attempt.
      feeUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        initiateFeePayment("c1", "u1", "https://zakai.test", "he"),
      ).rejects.toMatchObject({ message: "CHECKOUT_IN_PROGRESS" });
      expect(createCheckout).not.toHaveBeenCalled();
    },
  );

  it("claims with the exact providerRef just read, then calls the PSP once the claim succeeds", async () => {
    findFirst.mockResolvedValue({
      id: "c1",
      fee: { id: "f1", status: "PENDING", amount: 1800, mandateJti: "jti-live", providerRef: null },
    });
    findUnique.mockResolvedValue({ mandateJti: "jti-live", status: "ACTIVE" });
    feeUpdateMany.mockResolvedValue({ count: 1 });
    feeUpdate.mockResolvedValue({ id: "f1" });

    const result = await initiateFeePayment("c1", "u1", "https://zakai.test", "he");

    expect(feeUpdateMany).toHaveBeenCalledWith({
      where: { id: "f1", status: "PENDING", providerRef: null },
      data: { providerRef: expect.stringMatching(/^pending:/) },
    });
    expect(createCheckout).toHaveBeenCalledTimes(1);
    expect(result.checkoutUrl).toBe("https://pay.example/checkout");
  });

  it("releases the claim if the PSP call itself fails, so a retry is not permanently stuck", async () => {
    findFirst.mockResolvedValue({
      id: "c1",
      fee: { id: "f1", status: "PENDING", amount: 1800, mandateJti: "jti-live", providerRef: null },
    });
    findUnique.mockResolvedValue({ mandateJti: "jti-live", status: "ACTIVE" });
    feeUpdateMany.mockResolvedValue({ count: 1 });
    createCheckout.mockRejectedValue(new Error("PSP down"));

    await expect(initiateFeePayment("c1", "u1", "https://zakai.test", "he")).rejects.toThrow(
      "PSP down",
    );

    expect(feeUpdateMany).toHaveBeenCalledTimes(2);
    expect(feeUpdateMany.mock.calls[1][0]).toMatchObject({
      where: { id: "f1", providerRef: expect.stringMatching(/^pending:/) },
      data: { providerRef: null },
    });
  });
});

describe("confirmFeePayment — claim before flipping to PAID", () => {
  beforeEach(() => {
    feeFindUnique.mockReset();
    feeUpdateMany.mockReset();
  });

  it(
    "never reports success from a losing concurrent confirm — the real-PSP shape: the GET " +
      "browser bounce and the POST webhook for the same payment both read PENDING, both pass " +
      "the providerRef check, and only the where-clause re-check at write time can tell them apart",
    async () => {
      feeFindUnique.mockResolvedValue({ id: "f1", status: "PENDING", providerRef: "ref-1" });
      // Simulates the other concurrent call's updateMany having already flipped
      // this fee to PAID between our read and our own claim attempt.
      feeUpdateMany.mockResolvedValue({ count: 0 });

      const result = await confirmFeePayment("f1", "ref-1");

      expect(result).toBe(false);
      expect(feeUpdateMany).toHaveBeenCalledWith({
        where: { id: "f1", status: "PENDING", providerRef: "ref-1" },
        data: { status: "PAID", paidAt: expect.any(Date) },
      });
    },
  );

  it("flips to PAID when the claim succeeds", async () => {
    feeFindUnique.mockResolvedValue({ id: "f1", status: "PENDING", providerRef: "ref-1" });
    feeUpdateMany.mockResolvedValue({ count: 1 });

    expect(await confirmFeePayment("f1", "ref-1")).toBe(true);
  });

  it("stays idempotent for an already-PAID fee without attempting another claim", async () => {
    feeFindUnique.mockResolvedValue({ id: "f1", status: "PAID", providerRef: "ref-1" });

    expect(await confirmFeePayment("f1", "ref-1")).toBe(true);
    expect(feeUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects a mismatched providerRef without ever attempting a claim", async () => {
    feeFindUnique.mockResolvedValue({ id: "f1", status: "PENDING", providerRef: "ref-1" });

    expect(await confirmFeePayment("f1", "wrong-ref")).toBe(false);
    expect(feeUpdateMany).not.toHaveBeenCalled();
  });
});
