import { describe, it, expect } from "vitest";
import { computeZakameter } from "./zakameter";
import { COMPENSATION_AGOROT } from "./flightRights";

describe("computeZakameter", () => {
  it("totals the four lines with conservative assumptions", () => {
    const r = computeZakameter({
      mobileMonthlyAgorot: 10_000, // ₪100/mo
      electricityMonthlyAgorot: 60_000, // ₪600/mo
      disruptedFlights: 1,
      unusedSubscriptions: 2,
    });
    // Mobile: 18% of ₪100 × 12 = ₪216/yr.
    expect(r.mobileYearlyAgorot).toBe(21_600);
    // Electricity floor: best flat plan 6.5% → ₪39/mo → ₪468/yr.
    expect(r.electricityYearlyAgorot).toBe(46_800);
    // Flights: lowest statutory tier per flight.
    expect(r.flightsAgorot).toBe(COMPENSATION_AGOROT.short);
    // Subscriptions: 2 × ₪35 × 12 = ₪840/yr.
    expect(r.subscriptionsYearlyAgorot).toBe(84_000);
    expect(r.totalAgorot).toBe(21_600 + 46_800 + COMPENSATION_AGOROT.short + 84_000);
  });

  it("estimates scale monotonically with the bills", () => {
    const small = computeZakameter({ mobileMonthlyAgorot: 5_000, electricityMonthlyAgorot: 30_000, disruptedFlights: 0, unusedSubscriptions: 0 });
    const big = computeZakameter({ mobileMonthlyAgorot: 20_000, electricityMonthlyAgorot: 90_000, disruptedFlights: 0, unusedSubscriptions: 0 });
    expect(big.totalAgorot).toBeGreaterThan(small.totalAgorot);
  });

  it("all-zero input yields zero, and negatives are clamped", () => {
    const r = computeZakameter({
      mobileMonthlyAgorot: 0,
      electricityMonthlyAgorot: 0,
      disruptedFlights: -3,
      unusedSubscriptions: -1,
    });
    expect(r.totalAgorot).toBe(0);
  });
});
