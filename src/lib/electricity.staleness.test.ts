import { describe, expect, it } from "vitest";
import {
  ELECTRICITY_RATES_MAX_AGE_MONTHS,
  ELECTRICITY_RATES_SNAPSHOT,
  electricityRatesAgeMonths,
  electricityRatesAreStale,
} from "./electricity";

/**
 * A freshness ratchet, in the spirit of this repo's other build-breaking
 * guards. Everything below except the last block is ordinary unit testing;
 * the last block is the point.
 */

describe("electricityRatesAgeMonths", () => {
  it("is zero during the snapshot month itself", () => {
    expect(electricityRatesAgeMonths(new Date("2026-07-15T00:00:00Z"))).toBe(0);
  });

  it("counts whole months across a year boundary", () => {
    expect(electricityRatesAgeMonths(new Date("2026-08-06T00:00:00Z"))).toBe(1);
    expect(electricityRatesAgeMonths(new Date("2027-01-01T00:00:00Z"))).toBe(6);
    expect(electricityRatesAgeMonths(new Date("2027-07-01T00:00:00Z"))).toBe(12);
  });
});

describe("electricityRatesAreStale", () => {
  it("tolerates a snapshot right up to the limit", () => {
    const atLimit = new Date("2026-07-01T00:00:00Z");
    atLimit.setUTCMonth(atLimit.getUTCMonth() + ELECTRICITY_RATES_MAX_AGE_MONTHS);
    expect(electricityRatesAreStale(atLimit)).toBe(false);
  });

  it("trips one month past the limit", () => {
    const past = new Date("2026-07-01T00:00:00Z");
    past.setUTCMonth(past.getUTCMonth() + ELECTRICITY_RATES_MAX_AGE_MONTHS + 1);
    expect(electricityRatesAreStale(past)).toBe(true);
  });
});

describe("the shipped snapshot", () => {
  it("is a well-formed YYYY-MM", () => {
    expect(ELECTRICITY_RATES_SNAPSHOT).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  /**
   * The ratchet. When this fails, the electricity discounts in
   * `electricity.ts` have gone unverified longer than the product is willing
   * to claim — re-read the suppliers' public price lists, update the table,
   * and bump ELECTRICITY_RATES_SNAPSHOT in the same commit.
   *
   * Do NOT "fix" this by raising the constant or deleting the test: that
   * converts a known-stale number into a silently-wrong one, and the whole
   * reason this file exists is that Zakai must never quote a saving it cannot
   * stand behind.
   */
  it("has been refreshed recently enough to quote to a user", () => {
    const age = electricityRatesAgeMonths();
    expect(
      electricityRatesAreStale(),
      `Electricity rates snapshot ${ELECTRICITY_RATES_SNAPSHOT} is ${age} months old ` +
        `(limit ${ELECTRICITY_RATES_MAX_AGE_MONTHS}). Re-verify the supplier price lists ` +
        `and bump ELECTRICITY_RATES_SNAPSHOT.`,
    ).toBe(false);
  });
});
