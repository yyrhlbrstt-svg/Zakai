/**
 * The market registry — the one place that knows which countries exist.
 *
 * A "market" is the tuple that actually varies across borders: which pack of
 * rights applies, which currency the amounts are in, which languages the app
 * is offered in there, and which language official correspondence has to be
 * written in.
 *
 * The last one is the distinction the product got wrong until now. UI language,
 * jurisdiction and document language are three independent axes:
 *
 *   - A Russian speaker in Israel  → UI `ru`, market IL, letters in Hebrew.
 *   - An Arabic speaker in Israel  → UI `ar`, market IL, letters in Hebrew.
 *   - An Israeli living in London  → UI `he`, market GB, letters in English.
 *   - A Spanish speaker in the US  → UI `en` (es later), market US, letters in English.
 *
 * Collapsing them into one setting is what makes a product monolingual and
 * mono-country by construction.
 */

import type { Locale } from "../../i18n/config";
import type { JurisdictionPack, UniversalProfile } from "./types";
import { GB_PACK } from "./packs/gb";
import { IL_PACK } from "./packs/il";
import { US_PACK } from "./packs/us";
import type { RightsProfile } from "../rights";

export interface Market {
  /** ISO 3166-1 alpha-2. */
  code: string;
  pack: JurisdictionPack;
  /**
   * UI languages offered in this market, most-spoken first. This is a
   * market-level decision, not a global one: Arabic and Russian matter in
   * Israel and are noise in Britain.
   */
  uiLocales: Locale[];
  /** Shown in a market picker, in the market's own primary language. */
  label: string;
}

export const MARKETS: Record<string, Market> = {
  IL: { code: "IL", pack: IL_PACK, uiLocales: ["he", "ar", "ru", "en"], label: "ישראל" },
  GB: { code: "GB", pack: GB_PACK, uiLocales: ["en"], label: "United Kingdom" },
  US: { code: "US", pack: US_PACK, uiLocales: ["en"], label: "United States" },
};

export const DEFAULT_MARKET = "IL";

export function getMarket(code: string | undefined | null): Market {
  if (!code) return MARKETS[DEFAULT_MARKET];
  return MARKETS[code.toUpperCase()] ?? MARKETS[DEFAULT_MARKET];
}

export function isSupportedMarket(code: string): boolean {
  return code.toUpperCase() in MARKETS;
}

/** Every market, for pickers and for the coverage tests. */
export function allMarkets(): Market[] {
  return Object.values(MARKETS);
}

/**
 * Which UI language to open in, given the market and what the browser asked
 * for. Falls back to the market's primary language rather than to a global
 * default — a visitor in Britain should not land in Hebrew because Hebrew is
 * the app's oldest locale.
 */
export function preferredLocale(market: Market, accepted: readonly string[]): Locale {
  for (const tag of accepted) {
    const base = tag.split("-")[0]?.toLowerCase();
    const hit = market.uiLocales.find((l) => l === base);
    if (hit) return hit;
  }
  return market.uiLocales[0];
}

// ---------------------------------------------------------------------------
// Bridging the existing Israeli profile
// ---------------------------------------------------------------------------

/**
 * Convert the legacy Israeli questionnaire answers into the universal profile.
 *
 * Age buckets become a representative age in years. The buckets themselves are
 * a UI convenience whose boundaries are Israeli (67 is Israel's threshold, not
 * Britain's), so they must not survive into the shared profile — otherwise
 * every future pack inherits Israel's retirement age by accident.
 */
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
    // The legacy questionnaire never asked; absent facts must not be guessed.
    partnered: false,
    migrantYears: p.newImmigrant ? 3 : undefined,
    militaryReserve: p.reservist,
    recentMilitaryDischarge: p.dischargedSoldier,
    extra: {},
  };
}
