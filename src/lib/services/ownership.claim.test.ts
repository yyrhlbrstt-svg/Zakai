import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashCode } from "@/lib/codes";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  caseUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    phoneVerification: {
      findFirst: (...args: unknown[]) => mocks.findFirst(...args),
      updateMany: (...args: unknown[]) => mocks.updateMany(...args),
      update: (...args: unknown[]) => mocks.update(...args),
    },
    case: {
      update: (...args: unknown[]) => mocks.caseUpdate(...args),
    },
  },
}));

vi.mock("@/lib/messaging", () => ({
  sendSms: vi.fn(async () => ({ status: "SENT" })),
  sendEmail: vi.fn(async () => ({ status: "SENT" })),
  smsConfigured: () => true,
}));

import { verifyOwnershipCode } from "./ownership";

const CODE = "123456";

function baseRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "pv_1",
    userId: "user_1",
    caseId: null,
    codeHash: hashCode(CODE),
    attempts: 0,
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    ...overrides,
  };
}

describe("verifyOwnershipCode — atomic attempt-cap claim", () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.updateMany.mockReset();
    mocks.update.mockReset();
    mocks.caseUpdate.mockReset();
  });

  it("accepts a correct guess when the claim succeeds (count: 1)", async () => {
    mocks.findFirst.mockResolvedValue(baseRecord());
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.update.mockResolvedValue({});

    const res = await verifyOwnershipCode("user_1", CODE);

    expect(res).toEqual({ ok: true });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "pv_1", attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
  });

  it(
    "rejects with too_many_attempts when the claim loses the race (count: 0) — " +
      "the exact concurrency case: two requests read the same stale attempts value, " +
      "and only one write can land once the where-clause re-checks attempts at write time",
    async () => {
      mocks.findFirst.mockResolvedValue(baseRecord({ attempts: 5 }));
      mocks.updateMany.mockResolvedValue({ count: 0 });

      const res = await verifyOwnershipCode("user_1", CODE);

      expect(res).toEqual({ ok: false, error: "too_many_attempts" });
      // A lost claim must never reach the hash comparison or consume the code.
      expect(mocks.update).not.toHaveBeenCalled();
    },
  );

  it("rejects a wrong guess as invalid when attempts remain after the claim", async () => {
    mocks.findFirst.mockResolvedValue(baseRecord({ attempts: 0 }));
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const res = await verifyOwnershipCode("user_1", "000000");

    expect(res).toEqual({ ok: false, error: "invalid" });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong guess as too_many_attempts once the claimed attempt was the last one", async () => {
    mocks.findFirst.mockResolvedValue(baseRecord({ attempts: 4 }));
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const res = await verifyOwnershipCode("user_1", "000000");

    expect(res).toEqual({ ok: false, error: "too_many_attempts" });
  });

  it("stamps case ownership and consumes the code on a correct guess", async () => {
    mocks.findFirst.mockResolvedValue(baseRecord({ caseId: "case_1" }));
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.update.mockResolvedValue({});
    mocks.caseUpdate.mockResolvedValue({});

    const res = await verifyOwnershipCode("user_1", CODE, "case_1");

    expect(res).toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "pv_1" },
      data: { consumedAt: expect.any(Date) },
    });
    expect(mocks.caseUpdate).toHaveBeenCalledWith({
      where: { id: "case_1" },
      data: { ownershipVerifiedAt: expect.any(Date) },
    });
  });

  it("returns no_code when there is no active verification record", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const res = await verifyOwnershipCode("user_1", CODE);

    expect(res).toEqual({ ok: false, error: "no_code" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("returns expired without ever attempting the atomic claim", async () => {
    mocks.findFirst.mockResolvedValue(baseRecord({ expiresAt: new Date(Date.now() - 1000) }));

    const res = await verifyOwnershipCode("user_1", CODE);

    expect(res).toEqual({ ok: false, error: "expired" });
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
