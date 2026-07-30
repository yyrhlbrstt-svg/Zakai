import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PLANS, planConfig, canOpenCase, isPlanId, upgradeRequiresPayment } from "./plans";
import { computeFee } from "./fee";

describe("plans", () => {
  it("defines sane tier economics (Pro/Max buy the fee down, never up)", () => {
    expect(PLANS.FREE.feeRateBps).toBe(1800);
    expect(PLANS.PRO.feeRateBps).toBeLessThan(PLANS.FREE.feeRateBps);
    expect(PLANS.MAX.feeRateBps).toBeLessThanOrEqual(PLANS.PRO.feeRateBps);
    expect(PLANS.FREE.priceAgorot).toBe(0);
    expect(PLANS.PRO.priceAgorot).toBeGreaterThan(0);
    expect(PLANS.MAX.priceAgorot).toBeGreaterThan(PLANS.PRO.priceAgorot);
  });

  it("falls back to FREE for unknown/null plans", () => {
    expect(planConfig(null).id).toBe("FREE");
    expect(planConfig("BOGUS").id).toBe("FREE");
    expect(planConfig("MAX").id).toBe("MAX");
  });

  it("validates plan ids", () => {
    expect(isPlanId("PRO")).toBe(true);
    expect(isPlanId("pro")).toBe(false);
    expect(isPlanId("")).toBe(false);
  });

  it("enforces active-case allowances per tier", () => {
    expect(canOpenCase("FREE", 0)).toBe(true);
    expect(canOpenCase("FREE", 1)).toBe(false);
    expect(canOpenCase("PRO", 4)).toBe(true);
    expect(canOpenCase("PRO", 5)).toBe(false);
    expect(canOpenCase("MAX", 500)).toBe(true); // unlimited
    expect(canOpenCase(undefined, 1)).toBe(false); // unknown → FREE limits
  });

  it("Max plan yields a zero, non-chargeable fee on a real saving", () => {
    const fee = computeFee(10000, 5000, PLANS.MAX.feeRateBps);
    expect(fee.savingMonthly).toBe(5000);
    expect(fee.amount).toBe(0);
    expect(fee.chargeable).toBe(false);
  });

  it("Pro plan halves the Free fee", () => {
    const free = computeFee(10000, 5000, PLANS.FREE.feeRateBps);
    const pro = computeFee(10000, 5000, PLANS.PRO.feeRateBps);
    expect(pro.amount * 2).toBe(free.amount);
  });

  it("a paid upgrade requires payment; downgrades and same-tier do not", () => {
    // Upgrades to a higher-priced tier must be paid — the anti-give-away guard.
    expect(upgradeRequiresPayment("FREE", "PRO")).toBe(true);
    expect(upgradeRequiresPayment("FREE", "MAX")).toBe(true);
    expect(upgradeRequiresPayment("PRO", "MAX")).toBe(true);
    expect(upgradeRequiresPayment(null, "MAX")).toBe(true); // unknown → FREE-priced
    // Downgrades and no-ops are free and immediate.
    expect(upgradeRequiresPayment("MAX", "FREE")).toBe(false);
    expect(upgradeRequiresPayment("PRO", "FREE")).toBe(false);
    expect(upgradeRequiresPayment("MAX", "PRO")).toBe(false);
    expect(upgradeRequiresPayment("PRO", "PRO")).toBe(false);
    expect(upgradeRequiresPayment("FREE", "FREE")).toBe(false);
  });

  it("the in-app assistant states the real, current plan prices — not stale ones", () => {
    // The assistant's system prompt hardcodes prices as plain English text
    // (an LLM prompt can't import PLANS at runtime the way UI code can), which
    // is exactly how it silently drifted: PLANS.PRO was raised from ₪14.90 to
    // ₪19.90 and PLANS.MAX from ₪29.90 to ₪49.90, PlanCards.tsx picked up the
    // change automatically (it renders formatAgorot(p.priceAgorot) live), and
    // the assistant kept telling users the old numbers — a live "never
    // fabricate amounts" violation, just one nobody was checking for.
    const source = readFileSync("src/lib/ai.ts", "utf8");
    for (const id of ["PRO", "MAX"] as const) {
      const shekels = (PLANS[id].priceAgorot / 100).toFixed(2);
      expect({ plan: id, promptContains: source.includes(`₪${shekels}`) }).toEqual({
        plan: id,
        promptContains: true,
      });
    }
  });
});
