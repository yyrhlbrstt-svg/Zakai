import { describe, expect, it } from "vitest";
import {
  cohortLearning,
  expectedRecoveryAgorot,
  formatLearningBrief,
  type LearningOutcomeRow,
} from "./learningInsights";

function row(
  partial: Partial<LearningOutcomeRow> & Pick<LearningOutcomeRow, "variantId" | "paid">,
): LearningOutcomeRow {
  return {
    market: "IL",
    vertical: "telecom",
    counterparty: "cellcom",
    recoveredMinor: partial.paid ? 5_000 : 0,
    days: 12,
    selfReported: false,
    ...partial,
  };
}

describe("cohortLearning", () => {
  it("returns null below min trials", () => {
    const rows = [row({ variantId: "firm_statutory", paid: true })];
    expect(cohortLearning(rows, "IL", "telecom", "cellcom")).toBeNull();
  });

  it("picks highest EV stance and explains it", () => {
    const rows: LearningOutcomeRow[] = [
      ...Array.from({ length: 4 }, () =>
        row({ variantId: "cooperative_plain", paid: false, recoveredMinor: 0 }),
      ),
      ...Array.from({ length: 4 }, () =>
        row({ variantId: "firm_statutory", paid: true, recoveredMinor: 8_000, days: 10 }),
      ),
      row({ variantId: "firm_statutory", paid: false, recoveredMinor: 0, days: 20 }),
    ];
    const c = cohortLearning(rows, "IL", "telecom", "cellcom");
    expect(c).not.toBeNull();
    expect(c!.trials).toBe(9);
    expect(c!.bestStance?.variantId).toBe("firm_statutory");
    expect(c!.bestStance?.whyEn).toMatch(/Firm \+ statute/);
    expect(c!.medianDaysToWin).toBe(10);
  });

  it("ignores non-catalog variant ids", () => {
    const rows = Array.from({ length: 6 }, () =>
      row({ variantId: "standard", paid: true, recoveredMinor: 3_000 }),
    );
    expect(cohortLearning(rows, "IL", "telecom", "cellcom")).toBeNull();
  });
});

describe("expectedRecoveryAgorot", () => {
  it("uses cold prior when win rate unknown", () => {
    expect(expectedRecoveryAgorot(10_000, 0, null)).toBe(3_500);
  });

  it("scales by documented win rate", () => {
    expect(expectedRecoveryAgorot(10_000, 0, 0.5)).toBe(5_000);
  });
});

describe("formatLearningBrief", () => {
  it("emits BEST_STANCE and TIMING lines", () => {
    const brief = formatLearningBrief({
      market: "IL",
      vertical: "telecom",
      counterparty: "cellcom",
      trials: 10,
      winRate: 0.6,
      avgRecoveredMinor: 5_000,
      medianDaysToWin: 11,
      bestStance: {
        variantId: "firm_statutory",
        labelHe: "נחרץ + חוק",
        labelEn: "Firm + statute",
        trials: 6,
        wins: 4,
        winRate: 0.67,
        avgRecoveredMinor: 5_000,
        whyHe: "x",
        whyEn: "Firm + statute: 67% wins",
      },
    });
    expect(brief.some((l) => l.startsWith("BEST_STANCE:"))).toBe(true);
    expect(brief.some((l) => l.startsWith("TIMING:"))).toBe(true);
  });
});
