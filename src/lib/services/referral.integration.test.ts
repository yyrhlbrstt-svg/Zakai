import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import { prisma } from "@/lib/prisma";
import { recordSaving } from "./cases";
import { createAuthorization } from "./authorization";
import { REFERRAL_REWARD_AGOROT } from "@/lib/referral";
import { computeFee } from "@/lib/fee";

/**
 * Needs a real database. Skipped — not failed — when DATABASE_URL is absent.
 *
 * A suite that goes red on a clean checkout tells you nothing about the change
 * you just made, and trains everyone to ignore red. An unrunnable test is
 * missing coverage, which is honest; a failing one is a false alarm, which is
 * worse than no alarm at all.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;


/**
 * End-to-end referral flow against the real database:
 *  1. A referred friend's FIRST documented saving rewards the referrer.
 *  2. That credit then reduces the referrer's OWN next success fee.
 *  3. A referred user's second success does not grant a second reward.
 */

const tag = `ref-test-${Date.now()}`;
let referrerId: string;
let friendId: string;

/**
 * Insert a case at SENT with a real Mandate bound, so recordSaving can settle
 * it.
 *
 * The Mandate binding became mandatory for a chargeable fee on 2026-08-04,
 * after this file was last touched, which left the suite red for anyone
 * running it against a database — and green in CI only because CI sets no
 * DATABASE_URL. These are the tests that stop referral farming, so losing
 * them silently was the expensive kind of quiet.
 */
async function sentCase(userId: string, originalAgorot: number, targetAgorot: number) {
  const kase = await prisma.case.create({
    data: {
      userId,
      provider: "cellcom",
      amountOriginal: originalAgorot,
      targetAmount: targetAgorot,
      status: "SENT",
    },
  });
  await createAuthorization(kase.id);
  return kase;
}

beforeAll(async () => {
  // A chargeable fee must be bound to a signed Mandate. Generated per run and
  // never persisted — production keys come from env and are not minted at
  // runtime.
  if (!process.env.MANDATE_SIGNING_JWK) {
    const { privateKey } = await generateKeyPair("Ed25519", { extractable: true });
    process.env.MANDATE_SIGNING_JWK = JSON.stringify(await exportJWK(privateKey));
    process.env.MANDATE_SIGNING_KID = "referral-integration-test";
  }
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

suite("referral rewards (integration)", () => {
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

  it(
    "never grants a referral reward for a self-reported save — the exact farming path: a burner " +
      "account referred by an attacker, self-reporting a fake saving, must not mint real credit " +
      "toward the referrer's future fees off a number nobody verified",
    async () => {
      const burner = await prisma.user.create({
        data: {
          email: `${tag}-burner@zakai.test`,
          name: "בורנר",
          phone: "+972500000012",
          passwordHash: "x",
          referredById: referrerId,
        },
      });
      try {
        const creditBefore = (await prisma.user.findUnique({ where: { id: referrerId } }))!
          .referralCreditAgorot;

        const kase = await sentCase(burner.id, 10000, 5000);
        await recordSaving(kase.id, burner.id, 50, { selfReported: true });

        const reward = await prisma.referralReward.findUnique({
          where: { referredUserId: burner.id },
        });
        expect(reward).toBeNull();

        const referrerAfter = await prisma.user.findUnique({ where: { id: referrerId } });
        expect(referrerAfter!.referralCreditAgorot).toBe(creditBefore);
      } finally {
        await prisma.case.deleteMany({ where: { userId: burner.id } });
        await prisma.user.delete({ where: { id: burner.id } });
      }
    },
  );
});
