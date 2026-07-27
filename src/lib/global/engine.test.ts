import { describe, expect, it } from "vitest";
import { evaluatePack, renderDocument, validatePack } from "./engine";
import { fromLegacyIsraeliProfile, allMarkets, getMarket, preferredLocale } from "./registry";
import { IL_PACK } from "./packs/il";
import { GB_PACK } from "./packs/gb";
import { ENTITLEMENTS, evaluateRights, type RightsProfile } from "../rights";
import { RIGHT_ACTIONS } from "../rightsActions";
import type { UniversalProfile } from "./types";

/** Every combination the legacy questionnaire can produce, near enough. */
function* legacyProfiles(): Generator<RightsProfile> {
  const ages = ["18_24", "25_44", "45_66", "67_plus"] as const;
  const jobs = ["employee", "self_employed", "unemployed", "student", "soldier", "retired"] as const;
  const flags = [false, true];
  for (const ageGroup of ages)
    for (const employment of jobs)
      for (const children of [0, 2])
        for (const childrenUnder6 of children === 0 ? [0] : [0, 1])
          for (const renting of flags)
            for (const lowIncome of flags)
              for (const newImmigrant of flags)
                for (const disability of flags)
                  for (const dischargedSoldier of flags)
                    for (const reservist of flags)
                      yield {
                        ageGroup,
                        employment,
                        children,
                        childrenUnder6,
                        renting,
                        lowIncome,
                        newImmigrant,
                        dischargedSoldier,
                        reservist,
                        disability,
                      };
}

describe("IL pack ↔ legacy engine parity", () => {
  it("covers every entitlement in the legacy catalog", () => {
    const packIds = new Set(IL_PACK.rights.map((r) => r.id));
    const missing = ENTITLEMENTS.filter((e) => !packIds.has(e.id)).map((e) => e.id);
    expect(missing).toEqual([]);
    expect(IL_PACK.rights).toHaveLength(ENTITLEMENTS.length);
  });

  it("has an in-app action for every legacy entitlement", () => {
    const missing = ENTITLEMENTS.filter((e) => !RIGHT_ACTIONS[e.id]).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("returns the identical set of rights across the whole profile matrix", () => {
    let checked = 0;
    const mismatches: string[] = [];

    for (const legacy of legacyProfiles()) {
      const expected = new Set(evaluateRights(legacy).matches.map((e) => e.id));
      const actual = new Set(
        evaluatePack(IL_PACK, fromLegacyIsraeliProfile(legacy)).matches.map((m) => m.right.id),
      );
      checked++;

      if (expected.size !== actual.size || [...expected].some((id) => !actual.has(id))) {
        const only = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x));
        mismatches.push(
          `${JSON.stringify(legacy)} — legacy-only: ${only(expected, actual)}, pack-only: ${only(actual, expected)}`,
        );
      }
    }

    expect(mismatches.slice(0, 5)).toEqual([]);
    expect(checked).toBeGreaterThan(1000);
  });

  it("agrees with the legacy engine on the quantified yearly total", () => {
    for (const legacy of legacyProfiles()) {
      const before = evaluateRights(legacy).quantifiedYearlyAgorot;
      const after = evaluatePack(IL_PACK, fromLegacyIsraeliProfile(legacy)).quantifiedYearlyMinor;
      expect(after).toBe(before);
    }
  });
});

describe("pack validation", () => {
  it("accepts every shipped pack", () => {
    for (const market of allMarkets()) {
      expect({ market: market.code, problems: validatePack(market.pack) }).toEqual({
        market: market.code,
        problems: [],
      });
    }
  });

  it("rejects a right that sends the customer to an external site", () => {
    const problems = validatePack({
      ...IL_PACK,
      rights: [
        {
          id: "leaky",
          category: "tax",
          when: { kind: "always" },
          source: "test",
          action: {
            kind: "letter",
            subject: "s",
            body: "Apply at https://www.gov.example/refunds",
          },
        },
      ],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("external link");
  });

  it("rejects a right with no statutory source", () => {
    const problems = validatePack({
      ...GB_PACK,
      rights: [
        {
          id: "unsourced",
          category: "tax",
          when: { kind: "always" },
          source: "  ",
          action: { kind: "tool", tool: "/flights" },
        },
      ],
    });
    expect(problems).toContain("GB:unsourced: missing statutory source");
  });
});

describe("a second jurisdiction needs no engine change", () => {
  const uk: UniversalProfile = {
    ageYears: 70,
    employment: "retired",
    dependents: 0,
    dependentsUnder6: 0,
    housing: "owner",
    incomeBand: "low",
    hasDisability: true,
    partnered: false,
    militaryReserve: false,
    recentMilitaryDischarge: false,
    extra: {},
  };

  it("evaluates the GB pack with the same engine as IL", () => {
    const result = evaluatePack(GB_PACK, uk);
    const ids = result.matches.map((m) => m.right.id);
    expect(ids).toContain("pension_credit");
    expect(ids).toContain("attendance_allowance");
    expect(ids).toContain("winter_fuel_payment");
    expect(ids).toContain("council_tax_single_person");
    // Age-gated the other way: PIP stops at State Pension age.
    expect(ids).not.toContain("personal_independence_payment");
    expect(result.currency).toBe("GBP");
  });

  it("keys matches by market so the outcome ledger stays comparable", () => {
    expect(evaluatePack(GB_PACK, uk).matches[0].key).toMatch(/^GB:/);
  });

  it("uses each market's own retirement threshold", () => {
    const at66 = { ...uk, ageYears: 66, employment: "employee" as const };
    expect(evaluatePack(GB_PACK, at66).matches.map((m) => m.right.id)).toContain(
      "attendance_allowance",
    );
    // Israel's threshold is 67, so the same person is not yet a senior there.
    const ilSeniorRights = evaluatePack(IL_PACK, at66).matches.map((m) => m.right.id);
    expect(ilSeniorRights).not.toContain("senior_card");
  });
});

describe("document rendering", () => {
  it("writes the letter in the market's document language, not the UI language", () => {
    const he = renderDocument(IL_PACK, "arnona_senior", { name: "דנה", id: "123", municipality: "חיפה" });
    expect(he?.body).toContain("חיפה");
    expect(he?.body).toContain("לכבוד");

    const en = renderDocument(GB_PACK, "council_tax_single_person", {
      name: "Dana",
      id: "QQ123456C",
      municipality: "Camden",
      accountNumber: "55512345",
    });
    expect(en?.body).toContain("Camden");
    expect(en?.body).toContain("25% single person discount");
  });

  it("leaves missing values as a visible blank rather than dropping them", () => {
    const doc = renderDocument(IL_PACK, "arnona_senior", { name: "דנה" });
    expect(doc?.body).toContain("____");
  });

  it("returns null for tool-backed rights, which have no letter", () => {
    expect(renderDocument(IL_PACK, "mobile_check", {})).toBeNull();
  });
});

describe("market registry", () => {
  it("offers Arabic and Russian in Israel and not in Britain", () => {
    expect(getMarket("IL").uiLocales).toContain("ar");
    expect(getMarket("IL").uiLocales).toContain("ru");
    expect(getMarket("GB").uiLocales).not.toContain("ar");
  });

  it("falls back to the market's own primary language, not the app's default", () => {
    expect(preferredLocale(getMarket("GB"), ["he-IL", "he"])).toBe("en");
    expect(preferredLocale(getMarket("IL"), ["ru-RU"])).toBe("ru");
    expect(preferredLocale(getMarket("IL"), ["fr-FR"])).toBe("he");
  });

  it("falls back to the default market for an unknown country", () => {
    expect(getMarket("ZZ").code).toBe("IL");
    expect(getMarket(undefined).code).toBe("IL");
  });
});
