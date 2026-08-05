import { describe, it, expect } from "vitest";
import {
  applyCredit,
  REFERRAL_REWARD_AGOROT,
  REFERRAL_MILESTONE_BONUS_AGOROT,
  nextReferralMilestone,
  referralRewardForCount,
} from "./referral";

describe("applyCredit", () => {
  it("applies nothing when there is no credit", () => {
    expect(applyCredit(1800, 0)).toEqual({ applied: 0, net: 1800, remainingCredit: 0 });
  });

  it("applies the full credit when the fee is larger", () => {
    // gross ₪18.00, credit ₪25.00 -> applies ₪18.00, fee 0, ₪7.00 credit left
    expect(applyCredit(1800, 2500)).toEqual({ applied: 1800, net: 0, remainingCredit: 700 });
  });

  it("never exceeds the fee (no negative fee, no cash back)", () => {
    // gross ₪5.00, credit ₪25.00 -> applies ₪5.00, ₪20.00 credit remains
    expect(applyCredit(500, 2500)).toEqual({ applied: 500, net: 0, remainingCredit: 2000 });
  });

  it("applies partial credit and leaves a net fee", () => {
    // gross ₪18.00, credit ₪10.00 -> applies ₪10.00, ₪8.00 net, no credit left
    expect(applyCredit(1800, 1000)).toEqual({ applied: 1000, net: 800, remainingCredit: 0 });
  });

  it("clamps negative inputs to zero", () => {
    expect(applyCredit(-100, -50)).toEqual({ applied: 0, net: 0, remainingCredit: 0 });
  });

  it("truncates fractional agorot defensively", () => {
    expect(applyCredit(1800.9, 1000.9)).toEqual({ applied: 1000, net: 800, remainingCredit: 0 });
  });

  it("uses a positive, whole-agora reward constant", () => {
    expect(Number.isInteger(REFERRAL_REWARD_AGOROT)).toBe(true);
    expect(REFERRAL_REWARD_AGOROT).toBeGreaterThan(0);
  });
});

describe("referralRewardForCount", () => {
  it("pays the flat reward on a non-milestone referral", () => {
    expect(referralRewardForCount(1)).toBe(REFERRAL_REWARD_AGOROT);
    expect(referralRewardForCount(2)).toBe(REFERRAL_REWARD_AGOROT);
    expect(referralRewardForCount(4)).toBe(REFERRAL_REWARD_AGOROT);
  });

  it("stacks the milestone bonus on top of the flat reward", () => {
    for (const [count, bonus] of Object.entries(REFERRAL_MILESTONE_BONUS_AGOROT)) {
      expect(referralRewardForCount(Number(count))).toBe(REFERRAL_REWARD_AGOROT + bonus);
    }
  });

  it("every milestone bonus is a positive, whole-agora amount", () => {
    for (const bonus of Object.values(REFERRAL_MILESTONE_BONUS_AGOROT)) {
      expect(Number.isInteger(bonus)).toBe(true);
      expect(bonus).toBeGreaterThan(0);
    }
  });
});

describe("nextReferralMilestone", () => {
  it("finds the next milestone strictly above the current count", () => {
    expect(nextReferralMilestone(0)).toEqual({ count: 3, bonusAgorot: 5000 });
    expect(nextReferralMilestone(2)).toEqual({ count: 3, bonusAgorot: 5000 });
    expect(nextReferralMilestone(3)).toEqual({ count: 5, bonusAgorot: 10000 });
    expect(nextReferralMilestone(9)).toEqual({ count: 10, bonusAgorot: 25000 });
  });

  it("returns null once every milestone has been passed", () => {
    expect(nextReferralMilestone(10)).toBeNull();
    expect(nextReferralMilestone(50)).toBeNull();
  });
});
