import { describe, expect, it } from "vitest";
import { PLANS } from "./plans";
import {
  MONTHS,
  WORTH_SWITCHING_AGOROT,
  adviseplan,
  crossoverAgorot,
  planCosts,
} from "./planForSaving";

const shekels = (n: number) => n * 100;

describe("planCosts", () => {
  it("charges the free plan only its success fee", () => {
    const free = planCosts(shekels(50)).find((c) => c.planId === "FREE")!;
    expect(free.subscriptionAgorot).toBe(0);
    // 18% of ₪50 × 12 = ₪108
    expect(free.feeAgorot).toBe(shekels(108));
  });

  it("charges the zero-fee plans only their subscription", () => {
    const max = planCosts(shekels(500)).find((c) => c.planId === "MAX")!;
    expect(max.feeAgorot).toBe(0);
    expect(max.subscriptionAgorot).toBe(PLANS.MAX.priceAgorot * MONTHS);
  });

  it("keeps every figure an exact integer in agorot", () => {
    // Basis points divide by 10,000 exactly, so no float may creep in.
    for (const c of planCosts(shekels(37.37))) {
      expect(Number.isInteger(c.feeAgorot)).toBe(true);
      expect(Number.isInteger(c.totalAgorot)).toBe(true);
    }
  });

  it("costs nothing on any plan without a subscription when nothing is saved", () => {
    const free = planCosts(0).find((c) => c.planId === "FREE")!;
    expect(free.totalAgorot).toBe(0);
  });

  it("treats a negative saving as zero rather than a rebate", () => {
    expect(planCosts(-5_000)[0].totalAgorot).toBe(0);
  });

  it("returns cheapest first", () => {
    const costs = planCosts(shekels(80));
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i].totalAgorot).toBeGreaterThanOrEqual(costs[i - 1].totalAgorot);
    }
  });
});

describe("adviseplan", () => {
  /**
   * The property that makes this advice rather than an ad. A recommender that
   * can never say "stay where you are" is selling, and would be found out.
   */
  it("recommends staying free for a small saving", () => {
    expect(adviseplan(shekels(20)).best.planId).toBe("FREE");
  });

  it("recommends a paid plan only once it genuinely costs less", () => {
    const advice = adviseplan(shekels(1_000));
    expect(advice.best.planId).not.toBe("FREE");
    expect(advice.best.totalAgorot).toBeLessThan(
      planCosts(shekels(1_000)).find((c) => c.planId === "FREE")!.totalAgorot,
    );
  });

  it("does not push a switch that saves almost nothing", () => {
    // Just below a crossover the difference is pennies; calling that a
    // recommendation is churn dressed as advice.
    const pro = crossoverAgorot("PRO");
    if (pro !== null && pro > 100) {
      const advice = adviseplan(pro - 100);
      if (advice.savesAgorot < WORTH_SWITCHING_AGOROT) {
        expect(advice.worthSwitching).toBe(false);
      }
    }
  });

  it("reports what the runner-up would have cost", () => {
    const advice = adviseplan(shekels(50));
    expect(advice.runnerUp).not.toBeNull();
    expect(advice.savesAgorot).toBe(
      advice.runnerUp!.totalAgorot - advice.best.totalAgorot,
    );
    expect(advice.savesAgorot).toBeGreaterThanOrEqual(0);
  });
});

describe("crossovers say who each plan is actually for", () => {
  it("has free as the cheapest option at the bottom", () => {
    expect(crossoverAgorot("FREE")).toBe(0);
  });

  /**
   * These are the numbers the pricing page should be built from. They are
   * asserted loosely — the exact figure moves whenever a price does, and
   * pinning it here would make every price change a test failure rather than
   * a deliberate decision.
   */
  it("puts every paid plan's crossover above the free plan's", () => {
    const free = crossoverAgorot("FREE")!;
    for (const id of ["PRO", "MAX"] as const) {
      const at = crossoverAgorot(id);
      if (at !== null) expect(at).toBeGreaterThan(free);
    }
  });

  it("orders the crossovers by price, so a dearer plan needs a bigger saving", () => {
    const pro = crossoverAgorot("PRO");
    const max = crossoverAgorot("MAX");
    if (pro !== null && max !== null) expect(max).toBeGreaterThan(pro);
  });
});
