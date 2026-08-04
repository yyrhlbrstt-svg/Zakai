import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.fn();
const findUnique = vi.fn();
const feeUpdate = vi.fn();
const createCheckout = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: { findFirst: (...args: unknown[]) => findFirst(...args) },
    authorization: { findUnique: (...args: unknown[]) => findUnique(...args) },
    fee: { update: (...args: unknown[]) => feeUpdate(...args) },
  },
}));

vi.mock("@/lib/payments", () => ({
  paymentProvider: () => ({ createCheckout: (...args: unknown[]) => createCheckout(...args) }),
  paymentProviderName: () => "mock",
}));

import { initiateFeePayment, PaymentError } from "./payments";

describe("initiateFeePayment mandate binding", () => {
  beforeEach(() => {
    findFirst.mockReset();
    findUnique.mockReset();
    feeUpdate.mockReset();
    createCheckout.mockReset();
    createCheckout.mockResolvedValue({
      checkoutUrl: "https://pay.example/checkout",
      providerRef: "ref-1",
    });
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
});
