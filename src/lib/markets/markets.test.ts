import { describe, it, expect } from "vitest";
import { MARKETS, DEFAULT_MARKET, getMarket, formatMoney } from "./index";
import { formatAgorot } from "@/lib/money";

describe("market registry", () => {
  it("defaults to Israel and resolves known countries", () => {
    expect(DEFAULT_MARKET.country).toBe("IL");
    expect(getMarket("IL").currency).toBe("ILS");
    expect(getMarket("UK").currency).toBe("GBP");
    expect(getMarket("US").currency).toBe("USD");
    expect(getMarket("DE").currency).toBe("EUR");
  });

  it("formats the German market in euros", () => {
    expect(formatMoney(5000, MARKETS.DE)).toContain("€");
  });

  it("falls back to the default market for unknown/empty countries", () => {
    expect(getMarket("ZZ")).toBe(DEFAULT_MARKET);
    expect(getMarket(null)).toBe(DEFAULT_MARKET);
    expect(getMarket(undefined)).toBe(DEFAULT_MARKET);
  });
});

describe("formatMoney — world-ready generalization", () => {
  it("IL market is byte-for-byte identical to the legacy formatAgorot (regression invariant)", () => {
    for (const amount of [0, 100, 4999, 12345, 666, 100000]) {
      expect(formatMoney(amount, MARKETS.IL)).toBe(formatAgorot(amount, "he-IL"));
    }
  });

  it("whole units show no decimals; fractional units show two", () => {
    // 100 minor = 1 major (whole) → no decimals; 150 → 1.50
    expect(formatMoney(100, MARKETS.US)).toBe("$1");
    expect(formatMoney(150, MARKETS.US)).toBe("$1.50");
  });

  it("formats each market in its own currency", () => {
    expect(formatMoney(5000, MARKETS.US)).toContain("$");
    expect(formatMoney(5000, MARKETS.UK)).toContain("£");
    expect(formatMoney(5000, MARKETS.IL)).toContain("₪");
  });
});
