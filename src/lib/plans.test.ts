import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  PLANS,
  planConfig,
  canOpenCase,
  isPlanId,
  upgradeRequiresPayment,
  proBreakevenSavingAgorot,
  maxBreakevenSavingAgorot,
} from "./plans";
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

  it("the assistant's system prompt never hardcodes a plan price that can go stale", () => {
    // This used to hardcode prices as plain English text (an LLM prompt can't
    // import PLANS at runtime the way UI code can), which is exactly how it
    // silently drifted: PLANS.PRO was raised from ₪14.90 to ₪19.90 and
    // PLANS.MAX from ₪29.90 to ₪49.90, PlanCards.tsx picked up the change
    // automatically (it renders formatAgorot(p.priceAgorot) live), and the
    // assistant kept telling users the old numbers — a live "never fabricate
    // amounts" violation nobody was checking for. The fix that actually holds
    // is structural, not a fresher hardcoded number: buildAssistantSystem()
    // (src/lib/assistantSystem.ts) states no ₪ price at all and points to
    // /pricing instead, so there is nothing left to drift. Guard both halves
    // of that: the number's absence, and the live screen's presence.
    const source = readFileSync("src/lib/assistantSystem.ts", "utf8");
    for (const id of ["PRO", "MAX"] as const) {
      const shekels = (PLANS[id].priceAgorot / 100).toFixed(2);
      expect(source.includes(`₪${shekels}`), `assistantSystem.ts hardcodes a ${id} price again`).toBe(
        false,
      );
    }
    expect(source.includes("/pricing")).toBe(true);
  });

  it("derives the Pro breakeven from PLANS instead of a hand-copied constant", () => {
    // GROWTH.md hand-derives ~₪220/mo; this must track PLANS exactly so a
    // future price/rate tweak can't silently make the upgrade nudge wrong.
    const expectedAgorot = Math.round(
      (PLANS.PRO.priceAgorot / (PLANS.FREE.feeRateBps - PLANS.PRO.feeRateBps)) * 10000,
    );
    expect(proBreakevenSavingAgorot()).toBe(expectedAgorot);
    expect(proBreakevenSavingAgorot()).toBeGreaterThan(20_000); // sanity: > ₪200
    expect(proBreakevenSavingAgorot()).toBeLessThan(25_000); // sanity: < ₪250
  });

  it("derives Max breakeven from PLANS", () => {
    const fromFree = Math.round((PLANS.MAX.priceAgorot / PLANS.FREE.feeRateBps) * 10000);
    const fromPro = Math.round((PLANS.MAX.priceAgorot / PLANS.PRO.feeRateBps) * 10000);
    expect(maxBreakevenSavingAgorot("FREE")).toBe(fromFree);
    expect(maxBreakevenSavingAgorot("PRO")).toBe(fromPro);
    expect(fromPro).toBeGreaterThan(fromFree);
  });
});
