/**
 * The market registry — the one place that knows which countries exist.
 */

import type { Locale } from "../../i18n/config";
import type { JurisdictionPack, UniversalProfile } from "./types";
import { GB_PACK } from "./packs/gb";
import { IL_PACK } from "./packs/il";
import { US_PACK } from "./packs/us";
import { DE_PACK } from "./packs/de";
import type { RightsProfile } from "../rights";

export interface Market {
  code: string;
  pack: JurisdictionPack;
  uiLocales: Locale[];
  label: string;
}

export const MARKETS: Record<string, Market> = {
  IL: { code: "IL", pack: IL_PACK, uiLocales: ["he", "ar", "ru", "en"], label: "ישראל" },
  GB: { code: "GB", pack: GB_PACK, uiLocales: ["en"], label: "United Kingdom" },
  US: { code: "US", pack: US_PACK, uiLocales: ["en"], label: "United States" },
  DE: { code: "DE", pack: DE_PACK, uiLocales: ["en"], label: "Deutschland" },
};

export const DEFAULT_MARKET = "IL";

export function getMarket(code: string | undefined | null): Market {
  if (!code) return MARKETS[DEFAULT_MARKET];
  return MARKETS[code.toUpperCase()] ?? MARKETS[DEFAULT_MARKET];
}

export function isSupportedMarket(code: string): boolean {
  return code.toUpperCase() in MARKETS;
}

export function allMarkets(): Market[] {
  return Object.values(MARKETS);
}

export function preferredLocale(market: Market, accepted: readonly string[]): Locale {
  for (const tag of accepted) {
    const base = tag.split("-")[0]?.toLowerCase();
    const hit = market.uiLocales.find((l) => l === base);
    if (hit) return hit;
  }
  return market.uiLocales[0];
}

export function fromLegacyIsraeliProfile(p: RightsProfile): UniversalProfile {
  const ageYears = { "18_24": 21, "25_44": 35, "45_66": 55, "67_plus": 70 }[p.ageGroup];
  return {
    ageYears,
    employment: p.employment === "soldier" ? "military" : p.employment,
    dependents: p.children,
    dependentsUnder6: p.childrenUnder6,
    housing: p.renting ? "renting" : "owner",
    incomeBand: p.lowIncome ? "low" : "medium",
    hasDisability: p.disability,
    partnered: false,
    migrantYears: p.newImmigrant ? 3 : undefined,
    militaryReserve: p.reservist,
    recentMilitaryDischarge: p.dischargedSoldier,
    extra: {},
  };
}
