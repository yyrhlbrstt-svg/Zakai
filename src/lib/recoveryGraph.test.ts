import { describe, it, expect } from "vitest";
import { summarizeCounterparties, type CaseLite } from "./recoveryGraph";

const day = 86_400_000;
const base = new Date("2026-01-01T00:00:00Z");
const plusDays = (n: number) => new Date(base.getTime() + n * day);

function c(partial: Partial<CaseLite> & { provider: string; status: string }): CaseLite {
  return {
    createdAt: base,
    savingMonthly: null,
    recordedAt: null,
    ...partial,
  };
}

describe("summarizeCounterparties", () => {
  it("returns empty for no cases", () => {
    expect(summarizeCounterparties([])).toEqual([]);
  });

  it("computes win rate only over settled (replied) cases", () => {
    const rows = summarizeCounterparties([
      c({ provider: "cellcom", status: "SAVED", savingMonthly: 5000, recordedAt: plusDays(10) }),
      c({ provider: "cellcom", status: "NO_SAVING" }),
      c({ provider: "cellcom", status: "SENT" }), // not settled — excluded from rate
      c({ provider: "cellcom", status: "ANALYZED" }), // not settled — excluded
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].settled).toBe(2); // SAVED + NO_SAVING
    expect(rows[0].won).toBe(1);
    expect(rows[0].winRate).toBe(50);
  });

  it("averages saving across won cases only", () => {
    const rows = summarizeCounterparties([
      c({ provider: "partner", status: "SAVED", savingMonthly: 4000, recordedAt: plusDays(5) }),
      c({ provider: "partner", status: "SAVED", savingMonthly: 6000, recordedAt: plusDays(15) }),
      c({ provider: "partner", status: "NO_SAVING", savingMonthly: 0 }),
    ]);
    expect(rows[0].avgSavingAgorot).toBe(5000); // (4000+6000)/2
    expect(rows[0].avgDaysToResolve).toBe(10); // (5+15)/2
  });

  it("null win rate and null resolution time when nothing settled", () => {
    const rows = summarizeCounterparties([
      c({ provider: "bezeq", status: "SENT" }),
      c({ provider: "bezeq", status: "ANALYZED" }),
    ]);
    expect(rows[0].winRate).toBeNull();
    expect(rows[0].avgDaysToResolve).toBeNull();
    expect(rows[0].avgSavingAgorot).toBe(0);
  });

  it("sorts counterparties by settled count descending", () => {
    const rows = summarizeCounterparties([
      c({ provider: "hot", status: "NO_SAVING" }),
      c({ provider: "cellcom", status: "SAVED", savingMonthly: 3000, recordedAt: plusDays(3) }),
      c({ provider: "cellcom", status: "NO_SAVING" }),
    ]);
    expect(rows.map((r) => r.provider)).toEqual(["cellcom", "hot"]);
  });
});
