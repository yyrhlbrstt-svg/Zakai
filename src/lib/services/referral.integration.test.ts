import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordSaving } from "./cases";
import { REFERRAL_REWARD_AGOROT } from "@/lib/referral";
import { computeFee } from "@/lib/fee";

/**
 * End-to-end referral flow against the real database:
 *  1. A referred friend's FIRST documented saving rewards the referrer.
 *  2. That credit then reduces the referrer's OWN next success fee.
 *  3. A referred user's second success does not grant a second reward.
 */

const tag = `ref-test-${Date.now()}`;
let referrerId: string;
let friendId: string;

/** Insert a case already at SENT so recordSaving can settle it directly. */
async function sentCase(userId: string, originalAgorot: number, targetAgorot: number) {
  return prisma.case.create({
    data: {
      userId,
      provider: "cellcom",
      amountOriginal: originalAgorot,
      targetAmount: targetAgorot,
      status: "SENT",
    },
  });
}

beforeAll(async () => {
  const referrer = await prisma.user.create({
    data: {
      email: `${tag}-referrer@zakai.test`,
      name: "מזמין",
      phone: "+972500000010",
      passwordHash: "x",
      referralCode: `${tag}-code`,
    },
  });
  referrerId = referrer.id;
  const friend = await prisma.user.create({
    data: {
      email: `${tag}-friend@zakai.test`,
      name: "חבר",
      phone: "+972500000011",
      passwordHash: "x",
      referredById: referrerId,
    },
  });
  friendId = friend.id;
});

afterAll(async () => {
  await prisma.referralReward.deleteMany({ where: { referrerId } });
  await prisma.case.deleteMany({ where: { userId: { in: [referrerId, friendId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [referrerId, friendId] } } });
  await prisma.$disconnect();
});

describe("referral rewards (integration)", () => {
  it("rewards the referrer on the friend's first documented saving", async () => {
    // Friend saves ₪100 -> ₪50: gross fee = 18% of ₪50 = ₪9.00.
    const kase = await sentCase(friendId, 10000, 5000);
    const gross = computeFee(10000, 5000).amount;

    const res = await recordSaving(kase.id, friendId, 50);

    // Friend has no credit of their own, so the friend is charged the full fee.
    expect(res.creditApplied).toBe(0);
    expect(res.feeNet).toBe(gross);

    const reward = await prisma.referralReward.findUnique({
      where: { referredUserId: friendId },
    });
    expect(reward).not.toBeNull();
    expect(reward!.amountAgorot).toBe(REFERRAL_REWARD_AGOROT);
    expect(reward!.referrerId).toBe(referrerId);

    const referrer = await prisma.user.findUnique({ where: { id: referrerId } });
    expect(referrer!.referralCreditAgorot).toBe(REFERRAL_REWARD_AGOROT);
  });

  it("does not grant a second reward on the friend's next saving", async () => {
    const kase = await sentCase(friendId, 20000, 12000);
    await recordSaving(kase.id, friendId, 120);

    const rewards = await prisma.referralReward.count({ where: { referredUserId: friendId } });
    expect(rewards).toBe(1);

    const referrer = await prisma.user.findUnique({ where: { id: referrerId } });
    expect(referrer!.referralCreditAgorot).toBe(REFERRAL_REWARD_AGOROT);
  });

  it("applies the referrer's credit to their own next fee", async () => {
    // Referrer saves ₪100 -> ₪50: gross fee ₪9.00, fully covered by credit.
    const kase = await sentCase(referrerId, 10000, 5000);
    const gross = computeFee(10000, 5000).amount;

    const res = await recordSaving(kase.id, referrerId, 50);

    expect(res.creditApplied).toBe(gross);
    expect(res.feeNet).toBe(0);

    const fee = await prisma.fee.findUnique({ where: { caseId: kase.id } });
    expect(fee!.amount).toBe(0);
    expect(fee!.referralCreditApplied).toBe(gross);

    const referrer = await prisma.user.findUnique({ where: { id: referrerId } });
    expect(referrer!.referralCreditAgorot).toBe(REFERRAL_REWARD_AGOROT - gross);
  });
});
