import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const recordSaving = vi.fn();
const initiateFeePayment = vi.fn();
const paymentsFullyLive = vi.fn(() => false);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: { findUnique: (...args: unknown[]) => findUnique(...args) },
  },
}));

vi.mock("@/lib/services/cases", () => ({
  recordSaving: (...args: unknown[]) => recordSaving(...args),
  CaseError: class CaseError extends Error {},
}));

vi.mock("@/lib/services/payments", () => ({
  initiateFeePayment: (...args: unknown[]) => initiateFeePayment(...args),
  PaymentError: class PaymentError extends Error {},
}));

vi.mock("@/lib/deploy/releaseGate", () => ({
  paymentsFullyLive: () => paymentsFullyLive(),
}));

vi.mock("jose", () => ({
  SignJWT: class {
    private payload: Record<string, unknown> = {};
    constructor(p: Record<string, unknown>) {
      this.payload = p;
    }
    setProtectedHeader() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return Buffer.from(JSON.stringify(this.payload)).toString("base64url");
    }
  },
  jwtVerify: async (token: string) => ({
    payload: JSON.parse(Buffer.from(token, "base64url").toString("utf8")),
  }),
}));

import {
  consumeProposedSavingConfirm,
  issueProposedSavingConfirmUrl,
} from "./confirmProposedSaving";

describe("confirmProposedSaving", () => {
  beforeEach(() => {
    findUnique.mockReset();
    recordSaving.mockReset();
    initiateFeePayment.mockReset();
    paymentsFullyLive.mockReset();
    paymentsFullyLive.mockReturnValue(false);
    process.env.AUTH_SECRET = "x".repeat(32);
  });

  it("issues a locale confirm URL bound to the case", async () => {
    const url = await issueProposedSavingConfirmUrl({
      userId: "u1",
      caseId: "c1",
      newAmountShekels: 80,
      country: "IL",
    });
    expect(url).toContain("/he/saving/confirm?token=");
  });

  it("records saving on consume when case is SENT", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      status: "SENT",
      savingsProof: null,
    });
    recordSaving.mockResolvedValue({ feeNet: 0 });
    const url = await issueProposedSavingConfirmUrl({
      userId: "u1",
      caseId: "c1",
      newAmountShekels: 80,
      country: "IL",
    });
    const token = new URL(url!).searchParams.get("token")!;
    const result = await consumeProposedSavingConfirm(token);
    expect(result).toMatchObject({ ok: true, caseId: "c1", chargeable: false });
    expect(recordSaving).toHaveBeenCalledWith("c1", "u1", 80, { source: "inbound" });
    expect(initiateFeePayment).not.toHaveBeenCalled();
  });

  it("short-circuits when SavingsProof already exists", async () => {
    findUnique.mockResolvedValue({
      id: "c1",
      userId: "u1",
      status: "SAVED",
      savingsProof: { id: "sp1" },
    });
    const url = await issueProposedSavingConfirmUrl({
      userId: "u1",
      caseId: "c1",
      newAmountShekels: 80,
      country: "IL",
    });
    const token = new URL(url!).searchParams.get("token")!;
    const result = await consumeProposedSavingConfirm(token);
    expect(result).toMatchObject({ ok: true, alreadySettled: true });
    expect(recordSaving).not.toHaveBeenCalled();
  });
});
