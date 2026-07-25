import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { confirmFeePayment } from "./payments";

/**
 * Money-path security: confirmFeePayment must flip a fee to PAID ONLY when the
 * provider reference exactly matches the one we stored — never on a forged or
 * guessed reference. This is the invariant a payment callback depends on
 * (surfaced by the security review).
 */

const tag = `pay-test-${Date.now()}`;
const userIds: string[] = [];
const caseIds: string[] = [];

async function makeFee(providerRef: string | null) {
  const user = await prisma.user.create({
    data: {
      email: `${tag}-${Math.random().toString(36).slice(2)}@zakai.test`,
      name: "בדיקת תשלום",
      phone: "+972500000021",
      passwordHash: "x",
    },
  });
  userIds.push(user.id);
  const kase = await prisma.case.create({
    data: {
      userId: user.id,
      provider: "cellcom",
      amountOriginal: 10000,
      targetAmount: 8000,
      status: "SAVED",
    },
  });
  caseIds.push(kase.id);
  const fee = await prisma.fee.create({
    data: {
      caseId: kase.id,
      savingMonthly: 2000,
      amount: 360,
      status: "PENDING",
      provider: "mock",
      providerRef,
    },
  });
  return fee.id;
}

afterAll(async () => {
  await prisma.fee.deleteMany({ where: { caseId: { in: caseIds } } });
  await prisma.case.deleteMany({ where: { id: { in: caseIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("confirmFeePayment (money-path security)", () => {
  it("rejects a forged / wrong reference and leaves the fee unpaid", async () => {
    const feeId = await makeFee("mock_real_secret_ref");
    const ok = await confirmFeePayment(feeId, "mock_attacker_guess");
    expect(ok).toBe(false);
    const fee = await prisma.fee.findUnique({ where: { id: feeId } });
    expect(fee?.status).toBe("PENDING");
    expect(fee?.paidAt).toBeNull();
  });

  it("confirms only on an exact reference match", async () => {
    const feeId = await makeFee("mock_real_secret_ref");
    const ok = await confirmFeePayment(feeId, "mock_real_secret_ref");
    expect(ok).toBe(true);
    const fee = await prisma.fee.findUnique({ where: { id: feeId } });
    expect(fee?.status).toBe("PAID");
    expect(fee?.paidAt).not.toBeNull();
  });

  it("never confirms when no reference was ever stored", async () => {
    const feeId = await makeFee(null);
    // An empty/absent stored ref must not be matchable by an empty input.
    expect(await confirmFeePayment(feeId, "")).toBe(false);
    const fee = await prisma.fee.findUnique({ where: { id: feeId } });
    expect(fee?.status).toBe("PENDING");
  });

  it("is idempotent — a PAID fee stays PAID and reports success", async () => {
    const feeId = await makeFee("mock_real_secret_ref");
    await confirmFeePayment(feeId, "mock_real_secret_ref");
    // Even a subsequent wrong ref can't un-pay or error; already-PAID short-circuits.
    expect(await confirmFeePayment(feeId, "anything")).toBe(true);
    const fee = await prisma.fee.findUnique({ where: { id: feeId } });
    expect(fee?.status).toBe("PAID");
  });

  it("returns false for a non-existent fee id", async () => {
    expect(await confirmFeePayment("fee_does_not_exist", "x")).toBe(false);
  });
});
