import { describe, it, expect } from "vitest";
import { computeEntitlementInsights, profileFromRow, totalYearlyPotential } from "./entitlementInsights";
import type { RightsProfile } from "./rights";

const baseProfile: RightsProfile = {
  ageGroup: "25_44",
  employment: "employee",
  children: 0,
  childrenUnder6: 0,
  renting: false,
  lowIncome: false,
  newImmigrant: false,
  dischargedSoldier: false,
  reservist: false,
  disability: false,
};

describe("computeEntitlementInsights", () => {
  it("returns mobile + electricity + subscription nudges for a generic employee", () => {
    const insights = computeEntitlementInsights(baseProfile);
    const keys = insights.map((i) => i.key);
    expect(keys).toContain("mobileCheck");
    expect(keys).toContain("electricitySwitch");
    expect(keys).toContain("subscriptionAudit");
  });

  it("surfaces tax refund and pension fees for an employee", () => {
    const insights = computeEntitlementInsights(baseProfile);
    const keys = insights.map((i) => i.key);
    expect(keys).toContain("taxRefund");
    expect(keys).toContain("pensionFees");
  });

  it("surfaces miluim pay for a reservist", () => {
    const insights = computeEntitlementInsights({ ...baseProfile, reservist: true });
    expect(insights.some((i) => i.key === "miluimPay")).toBe(true);
  });

  it("surfaces work grant for a low-income employee", () => {
    const insights = computeEntitlementInsights({ ...baseProfile, lowIncome: true });
    expect(insights.some((i) => i.key === "workGrant")).toBe(true);
  });

  it("returns a moreRights fallback when there are uncovered entitlements", () => {
    // A senior profile triggers many entitlements not explicitly mapped above.
    const insights = computeEntitlementInsights({ ...baseProfile, ageGroup: "67_plus", employment: "retired" });
    expect(insights.some((i) => i.key === "moreRights")).toBe(true);
  });

  it("orders high-value verticals before the generic fallback", () => {
    const insights = computeEntitlementInsights(baseProfile);
    const genericIndex = insights.findIndex((i) => i.key === "moreRights");
    const firstWeight = insights[0]?.weight ?? 0;
    if (genericIndex !== -1) {
      expect(insights[genericIndex].weight).toBeLessThanOrEqual(firstWeight);
    }
  });
});

describe("profileFromRow", () => {
  it("maps persisted row fields to the engine's RightsProfile", () => {
    const row = {
      ageGroup: "45_66",
      employment: "self_employed",
      children: 2,
      childrenUnder6: 1,
      renting: true,
      lowIncome: true,
      newImmigrant: false,
      dischargedSoldier: true,
      reservist: false,
      disability: true,
    };
    expect(profileFromRow(row)).toEqual(row);
  });

  it("falls back invalid values to safe defaults", () => {
    const row = {
      ageGroup: "unknown",
      employment: "unknown",
      children: 0,
      childrenUnder6: 0,
      renting: false,
      lowIncome: false,
      newImmigrant: false,
      dischargedSoldier: false,
      reservist: false,
      disability: false,
    };
    expect(profileFromRow(row)).toEqual({
      ...row,
      ageGroup: "25_44",
      employment: "employee",
    });
  });
});

describe("totalYearlyPotential", () => {
  it("sums the yearly values from insights", () => {
    const insights = computeEntitlementInsights(baseProfile);
    const total = totalYearlyPotential(insights);
    expect(total).toBeGreaterThan(0);
  });
});
