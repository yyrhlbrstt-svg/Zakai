import { describe, expect, it } from "vitest";
import { buildSavingsLedgerSnapshot } from "./savingsLedger";

describe("buildSavingsLedgerSnapshot", () => {
  it("keeps empty ledger honest", () => {
    const snap = buildSavingsLedgerSnapshot({
      verifiedProofCount: 0,
      verifiedRecoveredMinor: 0,
      outcomes: [],
    });
    expect(snap.spec).toBe("zakai-savings-ledger");
    expect(snap.totals.verifiedProofCount).toBe(0);
    expect(snap.recent).toEqual([]);
    expect(snap.disclaimer).toMatch(/Empty totals/i);
  });

  it("separates verified totals from labelled recent rows", () => {
    const snap = buildSavingsLedgerSnapshot({
      verifiedProofCount: 2,
      verifiedRecoveredMinor: 50_000,
      outcomes: [
        {
          vertical: "telecom",
          counterparty: "cellcom",
          recoveredMinor: 12_000,
          days: 9,
          selfReported: false,
          createdAt: new Date("2026-08-01T12:00:00.000Z"),
        },
        {
          vertical: "subscription",
          counterparty: "netflix",
          recoveredMinor: 4_900,
          days: 3,
          selfReported: true,
          createdAt: new Date("2026-08-02T12:00:00.000Z"),
        },
      ],
    });
    expect(snap.totals.verifiedProofCount).toBe(2);
    expect(snap.totals.allOutcomeCount).toBe(2);
    expect(snap.totals.allRecoveredMinor).toBe(16_900);
    expect(snap.recent[1]?.selfReported).toBe(true);
    expect(snap.recent[0]?.createdAt).toBe("2026-08-01T12:00:00.000Z");
  });
});
