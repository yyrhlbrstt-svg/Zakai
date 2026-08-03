import type { Locale } from "../../i18n/config";
import type { JurisdictionPack, UniversalProfile } from "./types";
import { GB_PACK } from "./packs/gb";
import { IL_PACK } from "./packs/il";
import { US_PACK } from "./packs/us";
import { DE_PACK } from "./packs/de";
import { FR_PACK } from "./packs/fr";
import { CA_PACK } from "./packs/ca";
import { AU_PACK } from "./packs/au";
import { IE_PACK } from "./packs/ie";
import { NL_PACK } from "./packs/nl";
import { ES_PACK } from "./packs/es";
import { IT_PACK } from "./packs/it";
import { SE_PACK } from "./packs/se";
import { PL_PACK } from "./packs/pl";
import { EU_PACK } from "./packs/eu";
import { XX_PACK } from "./packs/xx";
import { NZ_PACK } from "./packs/nz";
import { ZA_PACK } from "./packs/za";
import { BR_PACK } from "./packs/br";
import { MX_PACK } from "./packs/mx";
import { IN_PACK } from "./packs/in";
import { JP_PACK } from "./packs/jp";
import { SG_PACK } from "./packs/sg";
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
  DE: { code: "DE", pack: DE_PACK, uiLocales: ["de", "en"], label: "Deutschland" },
  FR: { code: "FR", pack: FR_PACK, uiLocales: ["fr", "en"], label: "France" },
  CA: { code: "CA", pack: CA_PACK, uiLocales: ["en", "fr"], label: "Canada" },
  AU: { code: "AU", pack: AU_PACK, uiLocales: ["en"], label: "Australia" },
  IE: { code: "IE", pack: IE_PACK, uiLocales: ["en"], label: "Ireland" },
  NL: { code: "NL", pack: NL_PACK, uiLocales: ["en"], label: "Nederland" },
  ES: { code: "ES", pack: ES_PACK, uiLocales: ["en"], label: "España" },
  IT: { code: "IT", pack: IT_PACK, uiLocales: ["en"], label: "Italia" },
  SE: { code: "SE", pack: SE_PACK, uiLocales: ["en"], label: "Sverige" },
  PL: { code: "PL", pack: PL_PACK, uiLocales: ["en"], label: "Polska" },
  EU: { code: "EU", pack: EU_PACK, uiLocales: ["en", "de", "fr"], label: "European Union" },
  XX: { code: "XX", pack: XX_PACK, uiLocales: ["en"], label: "International / Worldwide" },
  NZ: { code: "NZ", pack: NZ_PACK, uiLocales: ["en"], label: "New Zealand" },
  ZA: { code: "ZA", pack: ZA_PACK, uiLocales: ["en"], label: "South Africa" },
  BR: { code: "BR", pack: BR_PACK, uiLocales: ["en"], label: "Brasil" },
  MX: { code: "MX", pack: MX_PACK, uiLocales: ["en"], label: "México" },
  IN: { code: "IN", pack: IN_PACK, uiLocales: ["en"], label: "India" },
  JP: { code: "JP", pack: JP_PACK, uiLocales: ["en"], label: "日本" },
  SG: { code: "SG", pack: SG_PACK, uiLocales: ["en"], label: "Singapore" },
};

export const DEFAULT_MARKET = "XX";

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
    extra: {
      hasMortgage: p.hasMortgage === true,
      specialNeedsChild: p.specialNeedsChild === true,
      withdrewProvidentFund: p.withdrewProvidentFund === true,
      soldProperty: p.soldProperty === true,
      livesInEligibleTown: p.livesInEligibleTown === true,
    },
  };
}
