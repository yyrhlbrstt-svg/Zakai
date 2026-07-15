import { describe, it, expect } from "vitest";
import { estimatePlans, ELECTRICITY_PLANS } from "./electricity";

const BILL = 60000; // ₪600/month in agorot

describe("estimatePlans", () => {
  it("without a smart meter only flat plans are offered", () => {
    const res = estimatePlans(BILL, "spread", false);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => !r.plan.requiresSmartMeter)).toBe(true);
    // Best flat plan is Electra 6.5%: 60000 * 0.065 = 3900 agorot/month.
    expect(res[0].plan.id).toBe("electra-flat");
    expect(res[0].monthlySavingAgorot).toBe(3900);
    expect(res[0].yearlySavingAgorot).toBe(3900 * 12);
  });

  it("night-heavy EV household ranks a night plan first", () => {
    const res = estimatePlans(BILL, "ev_night", true);
    expect(res[0].plan.window).toMatch(/night/);
    // Electra night 21% * 0.55 share * 5/7 weekdays = ~8.25% effective —
    // clearly better than the best flat 6.5%.
    const flat = res.find((r) => r.plan.id === "electra-flat")!;
    expect(res[0].monthlySavingAgorot).toBeGreaterThan(flat.monthlySavingAgorot);
  });

  it("day-at-home household ranks a day plan first", () => {
    const res = estimatePlans(BILL, "day_home", true);
    expect(res[0].plan.window).toBe("day");
    // 21% * 0.5 * 5/7 = 7.5% of 60000 = 4500.
    expect(res[0].monthlySavingAgorot).toBe(4500);
    expect(res[0].effectivePct).toBe(7.5);
  });

  it("saving is never negative and never exceeds the max discount", () => {
    for (const profile of ["day_home", "evening_family", "ev_night", "spread"] as const) {
      for (const r of estimatePlans(BILL, profile, true)) {
        expect(r.monthlySavingAgorot).toBeGreaterThanOrEqual(0);
        expect(r.monthlySavingAgorot).toBeLessThanOrEqual(BILL * 0.21);
      }
    }
  });

  it("handles zero and negative bills defensively", () => {
    expect(estimatePlans(0, "spread", true).every((r) => r.monthlySavingAgorot === 0)).toBe(true);
    expect(estimatePlans(-500, "spread", true).every((r) => r.monthlySavingAgorot === 0)).toBe(true);
  });

  it("rates table is sane (all discounts between 1% and 25%)", () => {
    for (const p of ELECTRICITY_PLANS) {
      expect(p.discountPct).toBeGreaterThan(0);
      expect(p.discountPct).toBeLessThanOrEqual(25);
    }
  });
});
