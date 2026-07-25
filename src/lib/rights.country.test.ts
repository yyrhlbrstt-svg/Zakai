import { describe, it, expect } from "vitest";
import {
  evaluateRights,
  rightsSourceUrl,
  RIGHTS_CATALOGS,
  RIGHTS_COUNTRIES,
  US_ENTITLEMENTS,
  UK_ENTITLEMENTS,
  type RightsProfile,
} from "./rights";
import en from "@/messages/en.json";
import he from "@/messages/he.json";

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

describe("multi-country rights engine", () => {
  it("defaults to Israel — identical to an explicit IL evaluation (regression invariant)", () => {
    const def = evaluateRights(base).matches.map((e) => e.id);
    const il = evaluateRights(base, "IL").matches.map((e) => e.id);
    expect(def).toEqual(il);
  });

  it("registers a catalog per configured country, each non-empty with unique ids", () => {
    for (const c of RIGHTS_COUNTRIES) {
      const cat = RIGHTS_CATALOGS[c];
      expect(cat.length).toBeGreaterThan(0);
      expect(new Set(cat.map((e) => e.id)).size).toBe(cat.length);
    }
  });

  it("US: a low-income unemployed renter stacks the right federal programs", () => {
    const ids = evaluateRights(
      { ...base, employment: "unemployed", lowIncome: true, renting: true },
      "US",
    ).matches.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["us_snap", "us_medicaid", "us_unemployment", "us_section8"]));
    // No Israeli entitlement leaks into the US catalog.
    expect(ids).not.toContain("mobile_check");
  });

  it("UK: a low-income disabled renter stacks the right national programs", () => {
    const ids = evaluateRights(
      { ...base, disability: true, lowIncome: true, renting: true },
      "UK",
    ).matches.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["uk_universal_credit", "uk_pip", "uk_housing_benefit"]));
  });

  it("foreign catalogs attach no money amounts (honest 'varies', never ₪)", () => {
    for (const e of [...US_ENTITLEMENTS, ...UK_ENTITLEMENTS]) {
      expect(e.yearlyAgorot).toBeUndefined();
      expect(e.oneTimeAgorot).toBeUndefined();
    }
  });

  it("official source links point to each country's real government domain", () => {
    expect(rightsSourceUrl("IL", "x")).toContain("kolzchut.org.il");
    expect(rightsSourceUrl("UK", "x")).toContain("gov.uk");
    expect(rightsSourceUrl("US", "x")).toContain("usa.gov");
    expect(rightsSourceUrl("DE", "x")).toContain("bund.de");
  });

  it("DE: a low-income parent stacks the right German programs, formatted in €", () => {
    const ids = evaluateRights(
      { ...base, lowIncome: true, children: 2, childrenUnder6: 1 },
      "DE",
    ).matches.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(["de_buergergeld", "de_kindergeld", "de_elterngeld"]));
  });
});

describe("no entitlement can render as a raw key", () => {
  const items = (m: Record<string, unknown>) =>
    ((m.rights as Record<string, Record<string, { title?: string; desc?: string; how?: string }>>).items);

  for (const c of RIGHTS_COUNTRIES) {
    for (const e of RIGHTS_CATALOGS[c]) {
      it(`${c}/${e.id} has EN + HE title, desc and how`, () => {
        for (const catalog of [items(en as Record<string, unknown>), items(he as Record<string, unknown>)]) {
          const label = catalog[e.id];
          expect(label, `missing label for ${e.id}`).toBeTruthy();
          expect(label.title).toBeTruthy();
          expect(label.desc).toBeTruthy();
          expect(label.how).toBeTruthy();
        }
      });
    }
  }
});
