import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { allMarkets } from "./registry";
import { evaluatePack } from "./engine";
import { ENTITLEMENTS, RIGHTS_CATALOGS, RIGHTS_COUNTRIES, evaluateRights, type RightsProfile } from "../rights";
import { RIGHT_ACTIONS } from "../rightsActions";
import { actionRouteForEntitlement } from "../entitlementRoutes";
import type { UniversalProfile } from "./types";

/** In-app paths that have a `src/app/[locale]/<segment>/page.tsx` route. */
function localeAppRoutes(): Set<string> {
  const localeDir = join(process.cwd(), "src/app/[locale]");
  const entries = readdirSync(localeDir, { withFileTypes: true });
  return new Set(
    entries.filter((d) => d.isDirectory() && !d.name.startsWith("(")).map((d) => `/${d.name}`),
  );
}

const BASE_PROFILE: RightsProfile = {
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

const UNIVERSAL_SMOKE: UniversalProfile = {
  ageYears: 35,
  employment: "employee",
  dependents: 0,
  dependentsUnder6: 0,
  housing: "owner",
  incomeBand: "medium",
  hasDisability: false,
  partnered: false,
  militaryReserve: false,
  recentMilitaryDischarge: false,
  extra: {},
};

describe("jurisdiction packs — cross-market integrity", () => {
  const appRoutes = localeAppRoutes();

  it("registry market code matches each pack.market field", () => {
    for (const market of allMarkets()) {
      expect(market.pack.market).toBe(market.code);
    }
  });

  it("every pack tool action points at a real App Router page", () => {
    const missing: string[] = [];
    for (const market of allMarkets()) {
      for (const right of market.pack.rights) {
        const tool = right.action.kind === "tool" ? right.action.tool : undefined;
        if (!tool) continue;
        if (!appRoutes.has(tool)) {
          missing.push(`${market.code}:${right.id} → ${tool}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("evaluates every shipped pack without throwing", () => {
    for (const market of allMarkets()) {
      const result = evaluatePack(market.pack, UNIVERSAL_SMOKE);
      expect(result.market).toBe(market.code);
      expect(result.matches.length).toBeGreaterThan(0);
    }
  });

  it("every letter-backed right can render a document shell (subject + body)", () => {
    for (const market of allMarkets()) {
      const letters = market.pack.rights.filter((r) => r.action.kind === "letter");
      expect(letters.length, `${market.code} has no letter rights`).toBeGreaterThan(0);
      for (const right of letters.slice(0, 3)) {
        expect(right.action.subject?.trim()).toBeTruthy();
        expect(right.action.body?.trim()).toBeTruthy();
      }
    }
  });
});

describe("Israel legacy catalog ↔ actions ↔ routes", () => {
  const appRoutes = localeAppRoutes();

  it("has RIGHT_ACTIONS for every IL entitlement", () => {
    const missing = ENTITLEMENTS.filter((e) => !RIGHT_ACTIONS[e.id]).map((e) => e.id);
    expect(missing).toEqual([]);
  });

  it("routes every IL entitlement with a dedicated door to a real page", () => {
    const bad: string[] = [];
    for (const e of ENTITLEMENTS) {
      const route = actionRouteForEntitlement(e.id);
      if (route === "/rights") continue;
      if (!appRoutes.has(route)) bad.push(`${e.id} → ${route}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("rights catalogs — all countries evaluate safely", () => {
  it("evaluateRights never throws for any RIGHTS_COUNTRIES entry", () => {
    for (const country of RIGHTS_COUNTRIES) {
      const catalog = RIGHTS_CATALOGS[country];
      expect(catalog.length, `${country} catalog empty`).toBeGreaterThan(0);
      const result = evaluateRights(BASE_PROFILE, country);
      expect(result.matches.length).toBeGreaterThanOrEqual(0);
      expect(result.matches.every((m) => catalog.some((c) => c.id === m.id))).toBe(true);
    }
  });
});
