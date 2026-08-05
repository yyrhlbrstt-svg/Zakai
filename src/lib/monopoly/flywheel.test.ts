import { describe, expect, it } from "vitest";
import { assessFlywheel, FLYWHEEL_PHASE } from "./flywheel";

describe("assessFlywheel", () => {
  it("starts in protocol phase with zero inputs", () => {
    const a = assessFlywheel({
      verifiedOutcomes: 0,
      savedCases: 0,
      activeAuthorizations: 0,
      registryIssuersActive: 1,
      delegatedIssuersActive: 0,
      collectiveIntentSignals: 0,
      marketsWithPacks: 12,
    });
    expect(a.phase).toBe(FLYWHEEL_PHASE.PROTOCOL);
    expect(a.gravityIndex).toBeGreaterThanOrEqual(0);
    expect(a.gravityIndex).toBeLessThanOrEqual(100);
  });

  it("advances phase as saved cases grow", () => {
    const a = assessFlywheel({
      verifiedOutcomes: 500,
      savedCases: 50,
      activeAuthorizations: 200,
      registryIssuersActive: 1,
      delegatedIssuersActive: 1,
      collectiveIntentSignals: 10_000,
      marketsWithPacks: 12,
    });
    expect(a.legs.learn).toBeGreaterThan(0);
    expect(["consumer_mass", "institutional", "commercial"]).toContain(a.phase);
  });
});
