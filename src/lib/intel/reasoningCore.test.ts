import { describe, expect, it } from "vitest";
import {
  classifyStakes,
  groundedRank,
  scoreConfidence,
  isLowConfidence,
  LOW_CONFIDENCE_THRESHOLD,
} from "./reasoningCore";

describe("classifyStakes", () => {
  it("sends anything an institution might act on down the expensive path", () => {
    for (const k of ["predict_institution", "institutional_risk_number", "exposure_simulation"]) {
      expect(classifyStakes(k), k).toBe("high_stakes");
    }
  });
  it("treats ordinary drafting as routine", () => {
    for (const k of ["draft_letter", "summarise_reply", "anything_else"]) {
      expect(classifyStakes(k), k).toBe("routine");
    }
  });
});

describe("groundedRank — agreement with reality beats agreement with models", () => {
  it("ranks a lone answer that matches the data above a unanimous one that contradicts it", () => {
    const candidates = [
      { source: "model-a", value: "wrong" },
      { source: "model-b", value: "wrong" },
      { source: "model-c", value: "wrong" },
      { source: "model-d", value: "right" },
    ];
    // The evidence says "right", whatever the majority thinks.
    const ranked = groundedRank(candidates, (v) => (v === "right" ? 1 : 0));
    expect(ranked[0].candidate.value).toBe("right");
    expect(ranked[0].candidate.source).toBe("model-d");
    // ...and the losing majority still shows its consensus honestly.
    expect(ranked[1].consensus).toBeCloseTo(2 / 3);
    expect(ranked[1].groundedness).toBe(0);
  });

  it("uses consensus only to break ties between equally grounded answers", () => {
    const ranked = groundedRank(
      [
        { source: "a", value: "x" },
        { source: "b", value: "x" },
        { source: "c", value: "y" },
      ],
      () => 0.5, // both equally supported by the evidence
    );
    expect(ranked[0].candidate.value).toBe("x");
    expect(ranked[0].groundedness).toBe(ranked[2].groundedness);
  });

  it("never lets consensus overturn a real evidence gap", () => {
    // Worst case for the weighting: unanimous-but-wrong vs alone-but-right.
    const unanimousWrong = groundedRank(
      [
        { source: "a", value: "no" },
        { source: "b", value: "no" },
        { source: "c", value: "no" },
        { source: "d", value: "yes" },
      ],
      (v) => (v === "yes" ? 0.6 : 0.4), // even a NARROW evidence lead must win
    );
    expect(unanimousWrong[0].candidate.value).toBe("yes");
  });

  it("handles a single candidate and an empty set without inventing consensus", () => {
    expect(groundedRank([], () => 1)).toEqual([]);
    const one = groundedRank([{ source: "a", value: 1 }], () => 1);
    expect(one[0].consensus).toBe(0);
    expect(one[0].groundedness).toBe(1);
  });

  it("clamps a misbehaving evidence function instead of trusting it", () => {
    const ranked = groundedRank([{ source: "a", value: 1 }], () => 99);
    expect(ranked[0].groundedness).toBe(1);
    expect(ranked[0].score).toBeLessThanOrEqual(1);
  });
});

describe("scoreConfidence", () => {
  it("keeps its three components separate so a low score can be explained", () => {
    const { confidence, parts } = scoreConfidence({
      crossModelAgreement: 1,
      volume: 40,
      newestDaysAgo: 0,
    });
    expect(parts).toEqual({ agreement: 1, volume: 1, recency: 1 });
    expect(confidence).toBeCloseTo(1);
  });

  it("will not let model agreement alone produce a confident number", () => {
    // Every model agrees — about two cases, from two years ago.
    const { confidence } = scoreConfidence({
      crossModelAgreement: 1,
      volume: 2,
      newestDaysAgo: 700,
    });
    expect(isLowConfidence(confidence)).toBe(true);
    expect(confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
  });

  it("treats no data as no recency rather than as fresh data", () => {
    const { parts } = scoreConfidence({ crossModelAgreement: 0, volume: 0, newestDaysAgo: null });
    expect(parts.recency).toBe(0);
  });
});
