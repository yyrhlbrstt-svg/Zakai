import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  createMany: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    receipt: {
      findMany: (...args: unknown[]) => mocks.findMany(...args),
      create: (...args: unknown[]) => mocks.create(...args),
      createMany: (...args: unknown[]) => mocks.createMany(...args),
    },
    connectedInboxInterest: {
      upsert: (...args: unknown[]) => mocks.upsert(...args),
    },
  },
}));

import { recordReceipt, listReceipts, exportReceiptsCsv, recordInboxInterest, recordReceiptsBulk } from "./receipts";
import type { ReceiptAnalysis } from "@/lib/ai";
import type { StatementTxn } from "@/lib/subscriptions";

function analysis(overrides: Partial<ReceiptAnalysis> = {}): ReceiptAnalysis {
  return {
    vendor: "Cellcom",
    amountShekels: 89.9,
    currency: "ILS",
    date: "2026-08-01",
    category: "recurring",
    hasVat: true,
    readable: true,
    ...overrides,
  };
}

describe("recordReceipt", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.create.mockReset();
  });

  it("stores agorot, not shekels, converted from the OCR result", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.create.mockResolvedValue({
      id: "rc_1",
      vendor: "Cellcom",
      amountAgorot: 8990,
      currency: "ILS",
      occurredAt: new Date("2026-08-01"),
      category: "recurring",
      hasVat: true,
      duplicateOfId: null,
      createdAt: new Date(),
    });

    await recordReceipt("user_1", analysis());

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountAgorot: 8990, userId: "user_1" }) }),
    );
  });

  it("flags a duplicate against the user's own recent receipts only", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "rc_0",
        vendor: "Cellcom",
        amountAgorot: 8990,
        occurredAt: new Date("2026-08-01"),
        createdAt: new Date("2026-08-01"),
      },
    ]);
    mocks.create.mockResolvedValue({
      id: "rc_1",
      vendor: "Cellcom",
      amountAgorot: 8990,
      currency: "ILS",
      occurredAt: new Date("2026-08-05"),
      category: "recurring",
      hasVat: true,
      duplicateOfId: "rc_0",
      createdAt: new Date(),
    });

    const result = await recordReceipt("user_1", analysis({ date: "2026-08-05" }));

    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ where: expect.objectContaining({ userId: "user_1" }) });
    expect(mocks.create.mock.calls[0][0].data.duplicateOfId).toBe("rc_0");
    expect(result.flagged).toBe(true);
  });

  it("does not flag when no receipt is readable/matching", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.create.mockResolvedValue({
      id: "rc_1",
      vendor: "Cellcom",
      amountAgorot: 8990,
      currency: "ILS",
      occurredAt: new Date("2026-08-01"),
      category: "recurring",
      hasVat: true,
      duplicateOfId: null,
      createdAt: new Date(),
    });

    const result = await recordReceipt("user_1", analysis());
    expect(result.flagged).toBe(false);
    expect(mocks.create.mock.calls[0][0].data.flaggedAt).toBeNull();
  });
});

describe("listReceipts / exportReceiptsCsv", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
  });

  it("scopes listReceipts to the given user", async () => {
    mocks.findMany.mockResolvedValue([]);
    await listReceipts("user_1");
    expect(mocks.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: "user_1" } });
  });

  it("renders a real CSV from the user's stored receipts", async () => {
    mocks.findMany.mockResolvedValue([
      {
        vendor: "Cellcom",
        amountAgorot: 8990,
        currency: "ILS",
        occurredAt: new Date("2026-08-01"),
        category: "recurring",
        hasVat: true,
        flaggedAt: null,
      },
    ]);
    const csv = await exportReceiptsCsv("user_1");
    expect(csv).toContain("Cellcom,89.90,ILS,2026-08-01,recurring,yes,no");
  });
});

describe("recordInboxInterest", () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
  });

  it("upserts on (userId, provider) so repeat clicks don't duplicate rows", async () => {
    await recordInboxInterest("user_1", "gmail");
    expect(mocks.upsert).toHaveBeenCalledWith({
      where: { userId_provider: { userId: "user_1", provider: "gmail" } },
      create: { userId: "user_1", provider: "gmail" },
      update: {},
    });
  });
});

function txn(overrides: Partial<StatementTxn> = {}): StatementTxn {
  return { date: new Date("2026-08-01"), merchant: "Office Depot", amountAgorot: 45000, ...overrides };
}

describe("recordReceiptsBulk", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.createMany.mockReset();
  });

  it("imports every valid row and skips non-positive/blank ones", async () => {
    mocks.findMany.mockResolvedValue([]);

    const result = await recordReceiptsBulk("user_1", [
      txn(),
      txn({ merchant: "Cellcom", amountAgorot: 8990 }),
      txn({ amountAgorot: 0 }), // skipped: nothing to claim
      txn({ merchant: "   " }), // skipped: blank vendor
    ]);

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(2);
    expect(mocks.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: "user_1", vendor: "Office Depot", source: "csv" }),
      ]),
    });
  });

  it("flags a duplicate against a previously stored receipt", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "rc_prior",
        vendor: "Office Depot",
        amountAgorot: 45000,
        occurredAt: new Date("2026-07-25"),
        createdAt: new Date("2026-07-25"),
      },
    ]);

    const result = await recordReceiptsBulk("user_1", [txn({ date: new Date("2026-08-01") })]);

    expect(result.flagged).toHaveLength(1);
    expect(result.flagged[0]).toMatchObject({ vendor: "Office Depot", amountAgorot: 45000 });
    const inserted = mocks.createMany.mock.calls[0][0].data;
    expect(inserted[0].duplicateOfId).toBe("rc_prior");
  });

  it("flags a duplicate against an earlier row in the SAME upload, not just stored receipts", async () => {
    mocks.findMany.mockResolvedValue([]);

    const result = await recordReceiptsBulk("user_1", [
      txn({ date: new Date("2026-08-01") }),
      txn({ date: new Date("2026-08-03") }), // same vendor+amount, 2 days later
    ]);

    expect(result.imported).toBe(2);
    expect(result.flagged).toHaveLength(1);
    const inserted = mocks.createMany.mock.calls[0][0].data;
    expect(inserted[0].duplicateOfId).toBeNull();
    expect(inserted[1].duplicateOfId).toBe(inserted[0].id);
  });

  it("never calls createMany for an all-invalid batch", async () => {
    mocks.findMany.mockResolvedValue([]);
    const result = await recordReceiptsBulk("user_1", [txn({ amountAgorot: 0 })]);
    expect(result.imported).toBe(0);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});
