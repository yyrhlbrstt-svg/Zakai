import { describe, it, expect } from "vitest";
import { computeInsights, type InsightInput } from "./insights";

const base: InsightInput = {
  plan: "FREE",
  referralCreditAgorot: 0,
  proPriceAgorot: 1490,
  cases: [],
};

describe("computeInsights", () => {
  it("suggests the first check when there are no cases", () => {
    const out = computeInsights(base);
    expect(out[0].key).toBe("firstCheck");
    expect(out[0].href).toBe("/check");
  });

  it("puts a pending recommendation first, with the potential saving", () => {
    const out = computeInsights({
      ...base,
      cases: [
        { status: "ANALYZED", amountOriginal: 12000, targetAmount: 9000, feeAgorot: 0, savedMonthlyAgorot: 0 },
        { status: "SAVED", amountOriginal: 10000, targetAmount: 8000, feeAgorot: 360, savedMonthlyAgorot: 2000 },
      ],
    });
    expect(out[0].key).toBe("pendingCase");
    expect(out[0].params.potential).toBe(3000);
    // The documented saving also appears, further down.
    const saved = out.find((i) => i.key === "savedSoFar")!;
    expect(saved.params.monthly).toBe(2000);
    expect(saved.params.yearly).toBe(24000);
  });

  it("suggests Pro when accumulated fees exceed its price (FREE only)", () => {
    const cases = [
      { status: "SAVED", amountOriginal: 30000, targetAmount: 20000, feeAgorot: 1800, savedMonthlyAgorot: 10000 },
    ];
    const free = computeInsights({ ...base, cases });
    expect(free.some((i) => i.key === "proPaysOff")).toBe(true);
    const pro = computeInsights({ ...base, plan: "PRO", cases });
    expect(pro.some((i) => i.key === "proPaysOff")).toBe(false);
  });

  it("reminds about a sent case awaiting the provider's reply", () => {
    const out = computeInsights({
      ...base,
      cases: [{ status: "SENT", amountOriginal: 10000, targetAmount: 8000, feeAgorot: 0, savedMonthlyAgorot: 0 }],
    });
    expect(out.some((i) => i.key === "awaitingReply")).toBe(true);
    // With an active case, the invite nudge stays out of the way.
    expect(out.some((i) => i.key === "invite")).toBe(false);
  });

  it("nudges a re-check when a documented saving is older than the promo window", () => {
    const fresh = computeInsights({
      ...base,
      cases: [{ status: "SAVED", amountOriginal: 10000, targetAmount: 8000, feeAgorot: 360, savedMonthlyAgorot: 2000, settledAgeDays: 30 }],
    });
    expect(fresh.some((i) => i.key === "recheck")).toBe(false);

    const stale = computeInsights({
      ...base,
      cases: [{ status: "SAVED", amountOriginal: 10000, targetAmount: 8000, feeAgorot: 360, savedMonthlyAgorot: 2000, settledAgeDays: 200 }],
    });
    const nudge = stale.find((i) => i.key === "recheck")!;
    expect(nudge.href).toBe("/check");
    expect(nudge.params.count).toBe(1);
  });

  it("suggests inviting a friend only when idle and creditless", () => {
    const idle = computeInsights(base);
    expect(idle.some((i) => i.key === "invite")).toBe(true);
    const credited = computeInsights({ ...base, referralCreditAgorot: 2500 });
    expect(credited.some((i) => i.key === "invite")).toBe(false);
  });
});
