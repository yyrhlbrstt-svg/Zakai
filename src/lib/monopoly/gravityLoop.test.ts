import { describe, expect, it } from "vitest";
import { planMonopolyLoop } from "./gravityLoop";

const emptyPipe = {
  mandatesIssued: 0,
  casesSent: 0,
  savingsProofs: 0,
  verifiedRecoveredMinor: 0,
  gravity_tier: "empty" as const,
};

describe("planMonopolyLoop", () => {
  it("blocks on SMTP before volume theater", () => {
    const plan = planMonopolyLoop({
      smtpConfigured: false,
      pipe: emptyPipe,
      infrastructureScore: 20,
      closedLoopMaturity: "skeleton",
      mandateMaturity: "skeleton",
      delegatedIssuersActive: 0,
    });
    expect(plan.p0.id).toBe("smtp");
    expect(plan.p0.blocksMonopoly).toBe(true);
    expect(plan.moves.some((m) => m.id === "hold_phase_d")).toBe(true);
  });

  it("asks for SENT volume when SMTP is on and pipe is empty", () => {
    const plan = planMonopolyLoop({
      smtpConfigured: true,
      pipe: emptyPipe,
      infrastructureScore: 25,
      closedLoopMaturity: "skeleton",
      mandateMaturity: "usable",
      delegatedIssuersActive: 0,
    });
    expect(plan.p0.id).toBe("volume_sent");
    expect(plan.thesisHe).toMatch(/Mandate/);
    expect(plan.irreversibility).toHaveLength(3);
    expect(plan.irreversibilityReady).toBe(false);
    expect(plan.irreversibility.every((c) => !c.met)).toBe(true);
  });

  it("marks irreversibility only when all three conditions clear", () => {
    const plan = planMonopolyLoop({
      smtpConfigured: true,
      pipe: {
        mandatesIssued: 25,
        casesSent: 30,
        savingsProofs: 12,
        verifiedRecoveredMinor: 100_000,
        gravity_tier: "gravity",
      },
      infrastructureScore: 55,
      closedLoopMaturity: "usable",
      mandateMaturity: "usable",
      delegatedIssuersActive: 1,
    });
    expect(plan.irreversibilityReady).toBe(true);
    expect(plan.irreversibility.every((c) => c.met)).toBe(true);
  });

  it("opens institution pull only at gravity tier", () => {
    const plan = planMonopolyLoop({
      smtpConfigured: true,
      pipe: {
        mandatesIssued: 30,
        casesSent: 25,
        savingsProofs: 5,
        verifiedRecoveredMinor: 50_000,
        gravity_tier: "gravity",
      },
      infrastructureScore: 40,
      closedLoopMaturity: "usable",
      mandateMaturity: "gravity",
      delegatedIssuersActive: 1,
    });
    expect(plan.moves.some((m) => m.id === "institution_pull")).toBe(true);
    expect(plan.moves.find((m) => m.id === "institution_pull")?.blocksMonopoly).toBe(false);
  });
});
