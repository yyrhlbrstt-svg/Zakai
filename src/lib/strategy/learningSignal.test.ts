import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
const recordOutcome = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    case: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      update: (...args: unknown[]) => update(...args),
      findMany: vi.fn(),
    },
    outbox: { findFirst: vi.fn() },
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
