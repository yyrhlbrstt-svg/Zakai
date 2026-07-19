import { describe, it, expect } from "vitest";
import {
  estimateUnemployment,
  unemploymentDays,
  UNEMPLOYMENT_CAP_FIRST_AGOROT,
} from "./unemployment";

describe("unemploymentDays", () => {
  it("increases with age", () => {
    expect(unemploymentDays(22)).toBe(50);
    expect(unemploymentDays(26)).toBe(67);
    expect(unemploymentDays(30)).toBe(100);
    expect(unemploymentDays(40)).toBe(138);
    expect(unemploymentDays(50)).toBe(175);
  });
});

describe("estimateUnemployment", () => {
  it("returns a low–high daily range with low below high", () => {
    const r = estimateUnemployment({ monthlyAgorot: 1_000_000, age: 35 }); // ₪10,000
    // dailyWage ≈ 400; 50%–80% → 200–320
    expect(r.dailyLowAgorot).toBe(20_000);
    expect(r.dailyHighAgorot).toBe(32_000);
    expect(r.dailyLowAgorot).toBeLessThan(r.dailyHighAgorot);
    expect(r.days).toBe(138);
  });

  it("caps the high end at the statutory maximum", () => {
    const r = estimateUnemployment({ monthlyAgorot: 3_000_000, age: 40 }); // ₪30,000
    expect(r.capped).toBe(true);
    expect(r.dailyHighAgorot).toBe(UNEMPLOYMENT_CAP_FIRST_AGOROT);
  });

  it("gives under-28 workers higher rates", () => {
    const young = estimateUnemployment({ monthlyAgorot: 800_000, age: 24 });
    const older = estimateUnemployment({ monthlyAgorot: 800_000, age: 40 });
    expect(young.dailyLowAgorot).toBeGreaterThan(older.dailyLowAgorot);
    expect(young.dailyHighAgorot).toBeGreaterThan(older.dailyHighAgorot);
  });

  it("totals use the first-period day cap (≤125)", () => {
    const r = estimateUnemployment({ monthlyAgorot: 1_000_000, age: 50 });
    expect(r.days).toBe(175);
    expect(r.totalLowAgorot).toBe(r.dailyLowAgorot * 125);
  });

  it("is zero at zero income", () => {
    const r = estimateUnemployment({ monthlyAgorot: 0, age: 30 });
    expect(r.dailyLowAgorot).toBe(0);
    expect(r.totalHighAgorot).toBe(0);
  });
});
