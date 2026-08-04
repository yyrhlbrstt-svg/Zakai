import { describe, expect, it } from "vitest";
import {
  buildFairnessCertifiedDocument,
  certifiedFromScores,
} from "./fairnessCertified";

describe("buildFairnessCertifiedDocument", () => {
  it("stays spec_only with empty certified list", () => {
    const doc = buildFairnessCertifiedDocument("https://zakai.example");
    expect(doc.status).toBe("spec_only");
    expect(doc.certified_providers).toEqual([]);
    expect(doc.honesty).toMatch(/empty/i);
    expect(doc.endpoints.scores).toContain("/api/fairness/scores");
    expect(doc.embed.snippet).toContain("zakai-widget.js");
  });

  it("lists only live MIN_SAMPLE scores when provided", () => {
    const scores = certifiedFromScores("IL", [
      {
        provider: "BankX",
        fairnessScore: 62,
        observations: 40,
        wins: 25,
        methodology: "strategy_outcome_win_rate",
      },
    ]);
    const doc = buildFairnessCertifiedDocument("https://zakai.example", {
      market: "IL",
      scores: [
        {
          provider: "BankX",
          fairnessScore: 62,
          observations: 40,
          wins: 25,
          methodology: "strategy_outcome_win_rate",
        },
      ],
    });
    expect(doc.status).toBe("live_scores");
    expect(doc.certified_providers).toEqual(scores);
    expect(doc.certified_providers[0]!.note).toMatch(/MIN_SAMPLE/);
  });
});
