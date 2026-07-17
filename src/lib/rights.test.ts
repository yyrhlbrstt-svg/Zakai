import { describe, it, expect } from "vitest";
import { ENTITLEMENTS, evaluateRights, type RightsProfile } from "./rights";

const base: RightsProfile = {
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

describe("rights catalog", () => {
  it("has 40+ unique entitlements", () => {
    expect(ENTITLEMENTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(ENTITLEMENTS.map((e) => e.id)).size).toBe(ENTITLEMENTS.length);
  });

  it("every predicate is total over representative profiles", () => {
    const profiles: RightsProfile[] = [
      base,
      { ...base, ageGroup: "67_plus", employment: "retired", lowIncome: true },
      { ...base, employment: "soldier", ageGroup: "18_24" },
      { ...base, employment: "unemployed", renting: true, lowIncome: true, children: 3, childrenUnder6: 1 },
      { ...base, newImmigrant: true, disability: true, reservist: true, dischargedSoldier: true },
    ];
    for (const p of profiles) {
      for (const e of ENTITLEMENTS) {
        expect(typeof e.eligible(p)).toBe("boolean");
      }
    }
  });

  it("a working parent gets child credits; a senior gets senior rights, not army ones", () => {
    const parent = evaluateRights({ ...base, children: 2, childrenUnder6: 1 });
    expect(parent.matches.map((e) => e.id)).toContain("credit_children");
    expect(parent.matches.map((e) => e.id)).toContain("daycare_subsidy");

    const senior = evaluateRights({ ...base, ageGroup: "67_plus", employment: "retired", lowIncome: true });
    const ids = senior.matches.map((e) => e.id);
    expect(ids).toContain("old_age_pension");
    expect(ids).toContain("arnona_senior");
    expect(ids).toContain("heating_grant");
    expect(ids).not.toContain("discharged_deposit");
  });

  it("a discharged low-income renting soldier stacks army + housing + tax", () => {
    const r = evaluateRights({
      ...base,
      dischargedSoldier: true,
      renting: true,
      lowIncome: true,
    });
    const ids = r.matches.map((e) => e.id);
    expect(ids).toContain("credit_discharged");
    expect(ids).toContain("discharged_deposit");
    expect(ids).toContain("rent_assistance");
    expect(ids).toContain("work_grant");
  });

  it("everyone gets the universal consumer rights, and results group by category", () => {
    const r = evaluateRights(base);
    const ids = r.matches.map((e) => e.id);
    for (const id of ["mobile_check", "electricity_switch", "flight_comp", "subscription_audit", "credit_report_free"]) {
      expect(ids).toContain(id);
    }
    expect(r.byCategory.get("consumer")!.length).toBeGreaterThanOrEqual(5);
    expect(r.quantifiedYearlyAgorot).toBeGreaterThan(0);
  });
});
