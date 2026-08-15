import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";
import { CONSUMER_PLAN_IDS, advisePlan, crossoverAgorot, planCosts } from "./planForSaving";

/**
 * The pricing page recommends a paid tier, so being wrong here costs the
 * reader money and costs us the benefit of the doubt.
 *
 * The specific failure this locks out: asking whether Max beats Free *or*
 * Pro and calling that "worth it". Those are different questions, and between
 * the two crossovers the answer diverges — Max's subscription undercuts
 * Free's 18% fee while Pro is cheaper still. The slider's default sat inside
 * that band, so the page opened by recommending the pricier tier.
 */
const shekels = (n: number) => n * 100;

describe("the advice is the cheapest plan, not the best-sounding one", () => {
  it("never names a plan that another plan beats on total cost", () => {
    for (let s = 0; s <= 2_000; s += 10) {
      const advice = advisePlan(shekels(s), CONSUMER_PLAN_IDS);
      const costs = planCosts(shekels(s), CONSUMER_PLAN_IDS);
      const cheapest = Math.min(...costs.map((c) => c.totalAgorot));
      expect(advice.best.totalAgorot, `at ₪${s}/mo`).toBe(cheapest);
    }
  });

  /**
   * The exact band the old component got wrong. Max already beats Free here,
   * which is what the page used to test, and Pro beats them both.
   */
  it("recommends Pro — not Max — in the band between the two crossovers", () => {
    const proFrom = crossoverAgorot("PRO", 500_000, CONSUMER_PLAN_IDS)!;
    const maxFrom = crossoverAgorot("MAX", 500_000, CONSUMER_PLAN_IDS)!;
    expect(proFrom).toBeLessThan(maxFrom);

    for (const saving of [33_500, 36_000, 40_000, 44_000]) {
      // Max genuinely beats Free at these levels — the old, insufficient test.
      const feeOnFree = Math.round((saving * PLANS.FREE.feeRateBps) / 10_000);
      expect(feeOnFree).toBeGreaterThanOrEqual(PLANS.MAX.priceAgorot);
      // And Pro is still cheaper, which is what the reader needed to be told.
      expect(advisePlan(saving, CONSUMER_PLAN_IDS).best.planId, `at ${saving} agorot`).toBe("PRO");
    }
  });

  it("recommends Max only once Max is actually cheapest", () => {
    const maxFrom = crossoverAgorot("MAX", 500_000, CONSUMER_PLAN_IDS)!;
    expect(advisePlan(maxFrom, CONSUMER_PLAN_IDS).best.planId).toBe("MAX");
    expect(advisePlan(maxFrom - 1_000, CONSUMER_PLAN_IDS).best.planId).not.toBe("MAX");
  });

  /**
   * A recommendation that can never say "don't upgrade" is not a
   * recommendation, it is an ad.
   */
  it("says stay on Free when a subscription would not pay for itself", () => {
    expect(advisePlan(0, CONSUMER_PLAN_IDS).best.planId).toBe("FREE");
    expect(advisePlan(shekels(50), CONSUMER_PLAN_IDS).best.planId).toBe("FREE");
  });

  it("does not offer a household a business subscription", () => {
    // Business only loses on today's prices, but that is an accident of the
    // numbers rather than a guarantee.
    for (let s = 0; s <= 5_000; s += 100) {
      expect(advisePlan(shekels(s), CONSUMER_PLAN_IDS).best.planId).not.toBe("BUSINESS");
    }
  });

  it("does not push a switch that saves a trivial amount", () => {
    // Just below the Pro crossover the difference is pennies a year; calling
    // that a reason to switch is churn dressed as advice.
    const proFrom = crossoverAgorot("PRO", 500_000, CONSUMER_PLAN_IDS)!;
    expect(advisePlan(proFrom, CONSUMER_PLAN_IDS).worthSwitching).toBe(false);
  });

  it("keeps every figure in integer agorot", () => {
    for (const s of [0, 137, 999, 4_321]) {
      for (const c of planCosts(shekels(s) + 0.7, CONSUMER_PLAN_IDS)) {
        expect(Number.isInteger(c.subscriptionAgorot)).toBe(true);
        expect(Number.isInteger(c.feeAgorot)).toBe(true);
        expect(Number.isInteger(c.totalAgorot)).toBe(true);
      }
    }
  });
});
