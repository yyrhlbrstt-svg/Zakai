import { describe, expect, it } from "vitest";
import {
  DRIFT_MIN_AGOROT,
  detectCostDrift,
  increasesOnly,
  netMonthlyDriftAgorot,
  snapshotFromCharges,
  type CostSnapshot,
} from "./costDrift";
import type { RecurringCharge } from "./subscriptions";

const snap = (charges: Array<[string, number]>): CostSnapshot => ({
  takenAt: "2026-07-01T00:00:00.000Z",
  charges: charges.map(([merchant, monthlyAgorot]) => ({ merchant, monthlyAgorot })),
});

describe("detectCostDrift", () => {
  it("catches the quiet increase that is the whole point", () => {
    const items = detectCostDrift(snap([["ישראכרט סליקה", 100_000]]), snap([["ישראכרט סליקה", 104_000]]));
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("increased");
    expect(items[0].deltaAgorot).toBe(4_000);
  });

  it("reports a charge that appeared, and one that stopped", () => {
    const items = detectCostDrift(snap([["בזק", 20_000]]), snap([["Google Workspace", 9_600]]));
    expect(items.find((i) => i.merchant === "Google Workspace")?.kind).toBe("new");
    expect(items.find((i) => i.merchant === "בזק")?.kind).toBe("gone");
  });

  /**
   * The noise floor is what keeps this trustworthy. Statement amounts wobble
   * by a few shekels; flagging that would bury the real increases and train
   * everyone to ignore the alert.
   */
  it("ignores wobble below the absolute floor", () => {
    const under = DRIFT_MIN_AGOROT - 1;
    expect(detectCostDrift(snap([["ספק", 50_000]]), snap([["ספק", 50_000 + under]]))).toEqual([]);
  });

  it("ignores a large absolute move that is proportionally trivial", () => {
    // ₪10 on a ₪10,000 bill is 0.1% — rounding, not a price change.
    expect(detectCostDrift(snap([["ספק", 1_000_000]]), snap([["ספק", 1_001_000]]))).toEqual([]);
  });

  it("still catches a small bill that doubled", () => {
    const items = detectCostDrift(snap([["אפליקציה", 2_000]]), snap([["אפליקציה", 4_000]]));
    expect(items[0].kind).toBe("increased");
  });

  it("matches merchants despite casing and spacing differences", () => {
    const items = detectCostDrift(snap([["Google  Workspace", 9_600]]), snap([["google workspace", 14_000]]));
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("increased");
  });

  it("puts increases first, largest first", () => {
    const items = detectCostDrift(
      snap([["A", 100_000], ["B", 100_000], ["C", 100_000]]),
      snap([["A", 90_000], ["B", 130_000], ["C", 110_000]]),
    );
    expect(items.map((i) => i.merchant)).toEqual(["B", "C", "A"]);
  });

  it("reports nothing when nothing moved", () => {
    const same = snap([["ספק", 50_000]]);
    expect(detectCostDrift(same, same)).toEqual([]);
  });

  it("handles a first-ever scan with no baseline", () => {
    const items = detectCostDrift(snap([]), snap([["ספק", 50_000]]));
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("new");
  });
});

describe("netMonthlyDriftAgorot", () => {
  it("nets rises against falls", () => {
    const items = detectCostDrift(
      snap([["A", 100_000], ["B", 100_000]]),
      snap([["A", 120_000], ["B", 90_000]]),
    );
    expect(netMonthlyDriftAgorot(items)).toBe(10_000);
  });

  it("is zero when nothing moved", () => {
    expect(netMonthlyDriftAgorot([])).toBe(0);
  });
});

describe("increasesOnly", () => {
  it("keeps rises and new charges, drops falls and stops", () => {
    const items = detectCostDrift(
      snap([["A", 100_000], ["B", 100_000]]),
      snap([["A", 120_000], ["C", 30_000]]),
    );
    expect(increasesOnly(items).map((i) => i.merchant).sort()).toEqual(["A", "C"]);
  });
});

describe("snapshotFromCharges", () => {
  it("keeps only what a comparison needs", () => {
    const charge: RecurringCharge = {
      merchant: "ספק",
      category: "other",
      monthlyAgorot: 50_000,
      occurrences: 3,
      providerKey: null,
      chargedOn: [],
    };
    const s = snapshotFromCharges([charge], new Date("2026-08-01T00:00:00Z"));
    expect(s.takenAt).toBe("2026-08-01T00:00:00.000Z");
    expect(s.charges).toEqual([{ merchant: "ספק", monthlyAgorot: 50_000 }]);
  });
});
