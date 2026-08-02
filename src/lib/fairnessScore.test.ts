import { describe, it, expect } from "vitest";
import { aggregateFairnessScores } from "./fairnessScore";
import { MIN_SAMPLE } from "./companyScore";

describe("aggregateFairnessScores", () => {
  it("hides providers below MIN_SAMPLE", () => {
    const rows = Array.from({ length: MIN_SAMPLE - 1 }, () => ({
      counterparty: "cellcom",
      won: true,
    }));
    expect(aggregateFairnessScores(rows)).toEqual([]);
  });

  it("computes win rate as fairnessScore", () => {
    const rows = [
      ...Array.from({ length: 3 }, () => ({ counterparty: "hot", won: true })),
      ...Array.from({ length: 2 }, () => ({ counterparty: "hot", won: false })),
    ];
    const s = aggregateFairnessScores(rows)[0];
    expect(s.fairnessScore).toBe(60);
    expect(s.observations).toBe(5);
  });
});
