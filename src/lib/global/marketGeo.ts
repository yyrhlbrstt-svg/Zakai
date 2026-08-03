import type { CountryCode } from "@/lib/verticals/types";
import { MARKETS, isSupportedMarket } from "./registry";

export const MARKET_COOKIE = "zakai_market";
export const MARKET_COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

/** EU / EEA members without a dedicated national pack in MARKETS → EU pack. */
const EU_MEMBER = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "GR",
  "HU",
  "IS",
  "LI",
  "LT",
  "LU",
  "LV",
  "MT",
  "NO",
  "PT",
  "RO",
  "SI",
  "SK",
  "CH",
]);

/**
 * Formerly CDN-only markets. EU is now a full JurisdictionPack in MARKETS.
 * Kept empty so /api/markets + /global stay consistent.
 */
export const CATALOG_ONLY_MARKETS: Record<string, { label: string; uiLocales: readonly string[] }> = {};

export function isCatalogMarket(code: string): boolean {
  const c = code.toUpperCase();
  return isSupportedMarket(c) || c in CATALOG_ONLY_MARKETS;
}

export function marketLabel(code: string): string {
  const c = code.toUpperCase();
  if (MARKETS[c]) return MARKETS[c].label;
  return CATALOG_ONLY_MARKETS[c]?.label ?? c;
}

/**
 * Map Vercel / Cloudflare geo (ISO 3166-1 alpha-2) to a Zakai market code.
 * Unknown countries get XX (international pack) — everyone can use the rails.
 */
export function marketFromGeoCountry(iso: string | null | undefined): string {
  const c = (iso ?? "").toUpperCase();
  if (!c || c === "XX" || c === "ZZ") return "XX";
  if (isCatalogMarket(c)) return c;
  if (EU_MEMBER.has(c)) return "EU";
  return "XX";
}

export function resolveVisitorMarket(
  cookieValue: string | undefined,
  geoCountry: string | null | undefined,
): string {
  const fromCookie = cookieValue?.trim().toUpperCase();
  if (fromCookie && isCatalogMarket(fromCookie)) return fromCookie;
  return marketFromGeoCountry(geoCountry);
}

/** RightsChecker uses legacy CountryCode keys (UK not GB). */
const MARKET_TO_RIGHTS_COUNTRY: Record<string, CountryCode> = {
  IL: "IL",
  GB: "UK",
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
  EU: "DE",
  XX: "US",
  NZ: "AU",
  ZA: "US",
  BR: "US",
  MX: "US",
  IN: "US",
  JP: "US",
  SG: "US",
};

export function rightsDefaultCountry(market: string): CountryCode {
  const m = market.toUpperCase();
  return MARKET_TO_RIGHTS_COUNTRY[m] ?? "US";
}

export function parseMarketParam(raw: string | null): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return isCatalogMarket(code) ? code : null;
}
