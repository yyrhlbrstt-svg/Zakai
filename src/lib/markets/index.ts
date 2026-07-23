/**
 * Market layer — the world-ready seam.
 *
 * Zakai stores every amount as an integer number of a currency's MINOR units
 * (agorot for ILS, pence for GBP, cents for USD/EUR). A "market" binds a country
 * to its currency, minor-unit ratio and formatting locale, so display code never
 * hard-codes "₪" / "ILS" again. Adding a country is adding a `Market` entry here
 * — never editing formatting call sites — mirroring the rule-pack pattern.
 *
 * Regression invariant: `formatMoney(x, MARKETS.IL)` is identical to the legacy
 * `formatAgorot(x, "he-IL")`. Generalising the world changes nothing at home.
 */
import type { CountryCode } from "@/lib/verticals/types";

export interface Market {
  /** ISO-3166 alpha-2. */
  country: CountryCode;
  /** ISO-4217 currency code. */
  currency: string;
  /** Minor units per major unit (100 for ILS/GBP/USD/EUR). */
  minorPerUnit: number;
  /** BCP-47 locale used for number/currency formatting. */
  bcp47: string;
  /** Native currency symbol, for compact non-Intl display. */
  symbol: string;
}

/**
 * Configured markets. Israel is live; UK and US are wired as configuration so a
 * second market is a data change, not a rewrite (they carry no full-service rule
 * pack yet — see verticals/packs.ts — so nothing acts on a user's behalf there).
 */
export const MARKETS: Record<CountryCode, Market> = {
  IL: { country: "IL", currency: "ILS", minorPerUnit: 100, bcp47: "he-IL", symbol: "₪" },
  UK: { country: "UK", currency: "GBP", minorPerUnit: 100, bcp47: "en-GB", symbol: "£" },
  US: { country: "US", currency: "USD", minorPerUnit: 100, bcp47: "en-US", symbol: "$" },
  DE: { country: "DE", currency: "EUR", minorPerUnit: 100, bcp47: "de-DE", symbol: "€" },
};

/** The launch market. Unknown/unset countries fall back here. */
export const DEFAULT_MARKET: Market = MARKETS.IL;

/** Resolve a market from an ISO country code; unknown codes → the default. */
export function getMarket(country?: string | null): Market {
  if (country && Object.prototype.hasOwnProperty.call(MARKETS, country)) {
    return MARKETS[country as CountryCode];
  }
  return DEFAULT_MARKET;
}

/**
 * Format an integer amount of MINOR units as a localized currency string. Whole
 * units show no decimals; fractional amounts show two. Defaults to the IL market
 * so existing callers get the exact legacy behaviour.
 */
export function formatMoney(minorUnits: number, market: Market = DEFAULT_MARKET): string {
  const major = minorUnits / market.minorPerUnit;
  const hasFraction = minorUnits % market.minorPerUnit !== 0;
  return new Intl.NumberFormat(market.bcp47, {
    style: "currency",
    currency: market.currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(major);
}
