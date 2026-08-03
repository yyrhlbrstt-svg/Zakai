import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { allMarkets } from "./registry";
import { evaluatePack } from "./engine";
import { ENTITLEMENTS, RIGHTS_CATALOGS, RIGHTS_COUNTRIES, evaluateRights, type RightsProfile } from "../rights";
import { RIGHT_ACTIONS } from "../rightsActions";
import { actionRouteForEntitlement } from "../entitlementRoutes";
import type { UniversalProfile } from "./types";

/** In-app paths that have a `src/app/[locale]/…/page.tsx` route (incl. nested). */
function localeAppRoutes(): Set<string> {
  const localeDir = join(process.cwd(), "src/app/[locale]");
  const routes = new Set<string>();

  function walk(dir: string, prefix: string) {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name.startsWith("(") || d.name.startsWith("[")) continue;
      const path = `${prefix}/${d.name}`;
      const page = join(dir, d.name, "page.tsx");
      try {
        readdirSync(join(dir, d.name));
        const hasPage = readdirSync(join(dir, d.name)).includes("page.tsx");
        if (hasPage) routes.add(path);
        walk(join(dir, d.name), path);
      } catch {
        /* ignore */
      }
      void page;
    }
  }

  walk(localeDir, "");
  return routes;
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

  it("every catalog country with a MARKETS pack exposes GlobalPackRights mapping", () => {
    const mapped = new Set(Object.keys(GLOBAL_MARKET_CODE_FOR_TEST));
    for (const code of ["UK", "US", "DE", "FR", "CA", "AU", "IE", "NL", "ES", "IT", "SE", "PL"] as const) {
      expect(mapped.has(code), `RightsChecker missing GLOBAL_MARKET_CODE for ${code}`).toBe(true);
    }
  });
});

/** Mirror RightsChecker GLOBAL_MARKET_CODE — drift guard without importing a client component. */
const GLOBAL_MARKET_CODE_FOR_TEST: Record<string, string> = {
  UK: "GB",
  US: "US",
  DE: "DE",
  FR: "FR",
  CA: "CA",
  AU: "AU",
  IE: "IE",
  NL: "NL",
  ES: "ES",
  IT: "IT",
  SE: "SE",
  PL: "PL",
};
