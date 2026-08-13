import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { confirmPlanPayment, expireLapsedPlans } from "./planOrders";

/**
 * Needs a real database. Skipped — not failed — when DATABASE_URL is absent,
 * for the reason the fee integration test gives: an unrunnable test is missing
 * coverage, which is honest; a failing one is a false alarm, which is worse
 * than no alarm.
 *
 * What is under test is the second revenue line's money path. A subscription
 * needs no Case, no Mandate and no outbound mail, which is exactly why it can
 * earn while the consumer loop is blocked — and exactly why it gets none of
 * the scrutiny that path accumulated. These are the four ways it could take
 * somebody's money and give the wrong thing back.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

const tag = `plan-test-${Date.now()}`;
const userIds: string[] = [];

async function makeUser(planUntil?: Date) {
  const user = await prisma.user.create({
    data: {
      email: `${tag}-${Math.random().toString(36).slice(2)}@zakai.test`,
      name: "בדיקת מנוי",
      phone: "+972500000031",
      passwordHash: "x",
      plan: planUntil ? "PRO" : "FREE",
      planUntil: planUntil ?? null,
    },
  });
  userIds.push(user.id);
  return user;
}

async function makeOrder(userId: string, providerRef: string | null, months = 1) {
  return prisma.planOrder.create({
    data: { userId, plan: "PRO", months, amount: 1990 * months, providerRef, provider: "test" },
  });
}

suite("plan purchase money path", () => {
  afterAll(async () => {
    if (!hasDb) return;
    await prisma.planOrder.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it("refuses a reference that does not match the stored one", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id, "ref_real");

    expect(await confirmPlanPayment(order.id, "ref_guessed")).toBe(false);

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.plan).toBe("FREE");
    expect(after?.planUntil).toBeNull();
  });

  it("grants the period on a matching reference, and is idempotent", async () => {
    const user = await makeUser();
    const order = await makeOrder(user.id, "ref_ok");

    expect(await confirmPlanPayment(order.id, "ref_ok")).toBe(true);
    const first = await prisma.user.findUnique({ where: { id: user.id } });
    expect(first?.plan).toBe("PRO");
    expect(first?.planUntil).toBeTruthy();

    // The browser bounce and the webhook both arrive. The second must not
    // extend the period a second time for one payment.
    expect(await confirmPlanPayment(order.id, "ref_ok")).toBe(true);
    const second = await prisma.user.findUnique({ where: { id: user.id } });
    expect(second?.planUntil?.getTime()).toBe(first?.planUntil?.getTime());
  });

  it("adds to an unexpired period instead of discarding the remainder", async () => {
    const existing = new Date(Date.now() + 20 * 24 * 3600 * 1000);
    const user = await makeUser(existing);
    const order = await makeOrder(user.id, "ref_extend");

    expect(await confirmPlanPayment(order.id, "ref_extend")).toBe(true);
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    /**
     * A month added to what was LEFT, not a month from today. The first
     * version of this asserted only "later than before", which a `from = now`
     * bug also satisfies — twenty days would have been silently thrown away
     * and the test would have stayed green. The floor is therefore the old
     * expiry plus most of a month.
     */
    const monthFromExisting = new Date(existing);
    monthFromExisting.setMonth(monthFromExisting.getMonth() + 1);
    expect(after!.planUntil!.getTime()).toBeGreaterThanOrEqual(
      monthFromExisting.getTime() - 2 * 24 * 3600 * 1000,
    );
  });

  it("downgrades a lapsed plan and leaves a live one alone", async () => {
    const lapsed = await makeUser(new Date(Date.now() - 24 * 3600 * 1000));
    const live = await makeUser(new Date(Date.now() + 24 * 3600 * 1000));

    await expireLapsedPlans();

    const wasLapsed = await prisma.user.findUnique({ where: { id: lapsed.id } });
    const stillLive = await prisma.user.findUnique({ where: { id: live.id } });
    expect(wasLapsed?.plan).toBe("FREE");
    expect(wasLapsed?.planUntil).toBeNull();
    expect(stillLive?.plan).toBe("PRO");
  });
});
