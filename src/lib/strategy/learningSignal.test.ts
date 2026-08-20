import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
const recordOutcome = vi.fn();
const outboxCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
      findMany: vi.fn(),
    },
    outbox: { findFirst: vi.fn(), count: (...args: unknown[]) => outboxCount(...args) },
  },
}));

vi.mock("@/lib/strategy/store", () => ({
  recordOutcome: (...args: unknown[]) => recordOutcome(...args),
  daysBetween: () => 5,
}));

vi.mock("@/lib/fee", () => ({
  documentedRecoveryMinor: (n: number) => n,
}));

vi.mock("@/lib/verticals", () => ({
  getRulePack: () => ({ feeBasis: "monthly" }),
}));

import {
  commitCaseLearningSignal,
  UNATTRIBUTED_VARIANT_ID,
} from "./learningSignal";
import { isCatalogVariantId, UNATTRIBUTED_VARIANT_ID as UNATTRIBUTED_FROM_KEYS } from "./normalizeKeys";

describe("commitCaseLearningSignal unattributed settle", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    recordOutcome.mockReset();
    findUnique.mockResolvedValue({
      outcomeRecordedAt: null,
      status: "SAVED",
    });
    update.mockResolvedValue({});
    recordOutcome.mockResolvedValue(undefined);
    outboxCount.mockReset();
    outboxCount.mockResolvedValue(0);
  });

  it("keeps UNATTRIBUTED_VARIANT_ID identical across modules", () => {
    expect(UNATTRIBUTED_VARIANT_ID).toBe(UNATTRIBUTED_FROM_KEYS);
    expect(UNATTRIBUTED_VARIANT_ID).toBe("baseline_unattributed");
  });

  it("records baseline_unattributed when strategyVariant is missing", async () => {
    const result = await commitCaseLearningSignal({
      caseId: "c1",
      context: { market: "IL", vertical: "telecom", counterparty: "partner" },
      variantId: null,
      paid: true,
      recoveredMinor: 2000,
      days: 7,
    });
    expect(result).toEqual({ recorded: true });
    expect(recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: UNATTRIBUTED_VARIANT_ID, paid: true }),
    );
    expect(isCatalogVariantId(UNATTRIBUTED_VARIANT_ID)).toBe(false);
  });

  it("keeps attributed variant when present", async () => {
    await commitCaseLearningSignal({
      caseId: "c1",
      context: { market: "IL", vertical: "telecom", counterparty: "partner" },
      variantId: "firm_statutory",
      paid: false,
      recoveredMinor: 0,
      days: 3,
    });
    expect(recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: "firm_statutory" }),
    );
  });
});

describe("pricing fields — every settle prices the ledger, wins and losses alike", () => {
  it("derives claim basis, escalation stage and right id from what the pipeline knows", async () => {
    findUnique.mockResolvedValue({
      outcomeRecordedAt: null,
      status: "NO_SAVING", // a LOSS still produces the pricing asset
      amountOriginal: 12_900,
      vertical: "subscription",
    });
    outboxCount.mockResolvedValue(2);

    const res = await commitCaseLearningSignal({
      caseId: "case-1",
      context: { market: "IL", vertical: "subscription", counterparty: "gymco" },
      variantId: "firm_statutory",
      paid: false,
      recoveredMinor: 0,
      days: 21,
    });

    expect(res.recorded).toBe(true);
    expect(recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        paid: false,
        claimBasisMinor: 12_900,
        escalationStage: "followup",
        rightId: "il.consumer.31a.continued-billing-after-cancellation",
      }),
    );
  });

  it("records null pricing fields — never guessed ones — when nothing is known", async () => {
    findUnique.mockResolvedValue({
      outcomeRecordedAt: null,
      status: "SAVED",
      amountOriginal: 0,
      vertical: "telecom",
    });
    outboxCount.mockRejectedValue(new Error("db blip"));

    const res = await commitCaseLearningSignal({
      caseId: "case-2",
      context: { market: "IL", vertical: "telecom", counterparty: "cellcom" },
      variantId: "firm_statutory",
      paid: true,
      recoveredMinor: 5_000,
      days: 9,
    });

    expect(res.recorded).toBe(true);
    expect(recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        claimBasisMinor: null,
        escalationStage: null,
        rightId: null,
      }),
    );
  });

  it("marks a single-dispatch settle as stage 'letter'", async () => {
    findUnique.mockResolvedValue({
      outcomeRecordedAt: null,
      status: "SAVED",
      amountOriginal: 8_000,
      vertical: "subscription",
    });
    outboxCount.mockResolvedValue(1);

    await commitCaseLearningSignal({
      caseId: "case-3",
      context: { market: "IL", vertical: "subscription", counterparty: "tvco" },
      variantId: "firm_statutory",
      paid: true,
      recoveredMinor: 8_000,
      days: 6,
    });

    expect(recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ escalationStage: "letter" }),
    );
  });
});
