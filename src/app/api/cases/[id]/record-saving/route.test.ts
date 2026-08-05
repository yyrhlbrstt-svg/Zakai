import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.fn();
const recordSaving = vi.fn();
const initiateFeePayment = vi.fn();

vi.mock("@/lib/api", () => ({
  requireUserId: () => requireUserId(),
  badRequest: (error: string, status = 400) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
}));

vi.mock("@/lib/services/cases", () => ({
  recordSaving: (...args: unknown[]) => recordSaving(...args),
  CaseError: class CaseError extends Error {},
}));

vi.mock("@/lib/services/payments", () => ({
  initiateFeePayment: (...args: unknown[]) => initiateFeePayment(...args),
  PaymentError: class PaymentError extends Error {},
}));

vi.mock("@/lib/money", () => ({
  agorotToShekels: (n: number) => n / 100,
}));

const paymentsFullyLive = vi.fn(() => false);

vi.mock("@/lib/deploy/releaseGate", () => ({
  paymentsFullyLive: () => paymentsFullyLive(),
}));

import { POST } from "./route";
import { CaseError } from "@/lib/services/cases";
import { PaymentError } from "@/lib/services/payments";

describe("POST /api/cases/[id]/record-saving", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    recordSaving.mockReset();
    initiateFeePayment.mockReset();
    paymentsFullyLive.mockReset();
    paymentsFullyLive.mockReturnValue(false);
    requireUserId.mockResolvedValue({ userId: "u1" });
  });

  it("surfaces AUTH_REVOKED from recordSaving", async () => {
    recordSaving.mockRejectedValue(new CaseError("AUTH_REVOKED"));
    const res = await POST(
      new Request("http://localhost/api/cases/c1/record-saving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newAmountShekels: 50 }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("AUTH_REVOKED");
  });

  it("surfaces checkoutError MANDATE_REQUIRED without failing the settle", async () => {
    paymentsFullyLive.mockReturnValue(true);
    recordSaving.mockResolvedValue({
      fee: { savingMonthly: 10000 },
      feeNet: 1800,
    });
    initiateFeePayment.mockRejectedValue(new PaymentError("MANDATE_REQUIRED"));
    const res = await POST(
      new Request("http://localhost/api/cases/c1/record-saving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newAmountShekels: 50 }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.checkoutError).toBe("MANDATE_REQUIRED");
    expect(body.checkoutUrl).toBeUndefined();
  });

  it("does not mint mock checkoutUrl for auto-redirect when PSP is not live", async () => {
    paymentsFullyLive.mockReturnValue(false);
    recordSaving.mockResolvedValue({
      fee: { savingMonthly: 10000 },
      feeNet: 1800,
    });
    const res = await POST(
      new Request("http://localhost/api/cases/c1/record-saving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newAmountShekels: 50 }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.chargeable).toBe(true);
    expect(body.paymentsLive).toBe(false);
    expect(body.checkoutUrl).toBeUndefined();
    expect(initiateFeePayment).not.toHaveBeenCalled();
  });

  it("surfaces settle-time MANDATE_REQUIRED from recordSaving", async () => {
    recordSaving.mockRejectedValue(new CaseError("MANDATE_REQUIRED"));
    const res = await POST(
      new Request("http://localhost/api/cases/c1/record-saving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newAmountShekels: 50 }),
      }),
      { params: Promise.resolve({ id: "c1" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("MANDATE_REQUIRED");
  });
});
