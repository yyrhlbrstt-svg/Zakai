import { describe, expect, it } from "vitest";
import { assessSevenRails, MONOPOLY_RAIL } from "./sevenRails";

describe("assessSevenRails", () => {
  it("returns seven rails with skeleton maturity at zero volume", () => {
    const report = assessSevenRails({
      verifiedOutcomes: 0,
      savedCases: 0,
      activeAuthorizations: 0,
      registryIssuersActive: 1,
      delegatedIssuersActive: 0,
      collectiveIntentSignals: 0,
      marketsWithPacks: 12,
      proofsDocumented: 0,
      marketsWithCitedRights: 8,
      fairnessProvidersScored: 0,
      attributedSignups: 0,
      packsOriginMirror: true,
    });
    expect(report.rails).toHaveLength(7);
    expect(report.rails.map((r) => r.id)).toContain(MONOPOLY_RAIL.MANDATE);
    expect(report.infrastructureScore).toBeGreaterThanOrEqual(0);
    expect(report.infrastructureScore).toBeLessThanOrEqual(100);
    expect(report.disclaimer).toMatch(/not revenue/i);
  });
});
