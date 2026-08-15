import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  PromiseError,
  brokenPromiseRates,
  checkPromise,
  loadPromise,
  openPromises,
  recordPromise,
} from "./promisedCredits";
import { GRACE_DAYS } from "@/lib/promisedCredit";

/**
 * This decides whether somebody gets charged, so it runs against the real
 * tables and the real status transitions rather than a mock that would agree
 * with whatever the code happens to do.
 *
 * Requires a live database; skipped without DATABASE_URL, like the other
 * integration suites.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

const NOW = new Date("2026-08-08T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const tag = `pc_${Math.random().toString(36).slice(2, 8)}`;
const userIds: string[] = [];

async function makeUser() {
  const u = await prisma.user.create({
    data: {
      email: `${tag}-${Math.random().toString(36).slice(2)}@zakai.test`,
      name: "Promise Tester",
      phone: "+972500000000",
      passwordHash: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhashno",
      referralCode: `rc_${Math.random().toString(36).slice(2, 10)}`,
    },
    select: { id: true },
  });
  userIds.push(u.id);
  return u.id;
}

async function makeCase(userId: string, status: "SENT" | "SAVED" = "SENT", provider = "cellcom") {
  return prisma.case.create({
    data: {
      userId,
      vertical: "telecom",
      provider,
      amountOriginal: 12_000,
      targetAmount: 9_000,
      status,
    },
    select: { id: true },
  });
}

afterAll(async () => {
  if (!hasDb) return;
  for (const id of userIds) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
  }
});

suite("a promise is recorded as a promise, not as money", () => {
  /**
   * The failure this exists to prevent: charging a success fee on an
   * agreement, before anything has actually moved.
   */
  it("creates no SavingsProof and no Fee", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await recordPromise(kase.id, userId, { promisedShekels: 3_000 }, NOW);

    expect(await prisma.savingsProof.findUnique({ where: { caseId: kase.id } })).toBeNull();
    expect(await prisma.fee.findUnique({ where: { caseId: kase.id } })).toBeNull();
    const after = await prisma.case.findUnique({ where: { id: kase.id }, select: { status: true } });
    expect(after!.status).toBe("SENT");
  });

  it("stores the amount in integer agorot", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    const row = await recordPromise(kase.id, userId, { promisedShekels: 1_234.56 }, NOW);
    expect(Number.isInteger(row.promisedMinor)).toBe(true);
    expect(row.promisedMinor).toBe(123_456);
  });

  it("refuses a promise of nothing", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await expect(recordPromise(kase.id, userId, { promisedShekels: 0 }, NOW)).rejects.toBeInstanceOf(
      PromiseError,
    );
  });

  it("refuses on a case that is not open", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId, "SAVED");
    await expect(
      recordPromise(kase.id, userId, { promisedShekels: 500 }, NOW),
    ).rejects.toMatchObject({ code: "NOT_SENT" });
  });

  it("refuses a second promise on the same case", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await recordPromise(kase.id, userId, { promisedShekels: 500 }, NOW);
    await expect(
      recordPromise(kase.id, userId, { promisedShekels: 900 }, NOW),
    ).rejects.toMatchObject({ code: "ALREADY_PROMISED" });
  });

  it("will not let one account record a promise on another's case", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const kase = await makeCase(owner);
    await expect(
      recordPromise(kase.id, stranger, { promisedShekels: 500 }, NOW),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

suite("an unchecked promise has no verdict", () => {
  /**
   * Calling it missing before anyone looked would report our own inattention
   * as the counterparty's failure — and it is the counterparty this number is
   * eventually going to name.
   */
  it("reports no verdict until a statement was actually checked", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await recordPromise(kase.id, userId, { promisedShekels: 3_000 }, daysAgo(120));
    const v = await loadPromise(kase.id, userId, NOW);
    expect(v!.verdict).toBeNull();
    expect(v!.observedMinor).toBeNull();
  });

  it("says when it is time to look, without claiming what will be found", async () => {
    const userId = await makeUser();
    const early = await makeCase(userId);
    await recordPromise(early.id, userId, { promisedShekels: 3_000 }, daysAgo(GRACE_DAYS - 5));
    expect((await loadPromise(early.id, userId, NOW))!.dueForCheck).toBe(false);

    const userId2 = await makeUser();
    const late = await makeCase(userId2);
    await recordPromise(late.id, userId2, { promisedShekels: 3_000 }, daysAgo(GRACE_DAYS + 1));
    expect((await loadPromise(late.id, userId2, NOW))!.dueForCheck).toBe(true);
  });

  it("honours a date they gave over the default grace period", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    // Promised long ago, but they said it lands next month — not late yet.
    await recordPromise(
      kase.id,
      userId,
      { promisedShekels: 3_000, dueBy: daysAhead(20) },
      daysAgo(GRACE_DAYS + 30),
    );
    expect((await loadPromise(kase.id, userId, NOW))!.dueForCheck).toBe(false);
  });
});

suite("checking records what was found, including nothing", () => {
  it("confirms a credit that arrived", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await recordPromise(kase.id, userId, { promisedShekels: 3_000 }, daysAgo(90));
    const v = await checkPromise(kase.id, userId, 3_000, NOW);
    expect(v.verdict!.state).toBe("arrived");
    expect(v.verdict!.shortfallMinor).toBe(0);
  });

  /**
   * "We looked and nothing came" is the finding this record exists to
   * capture. Storing it as null would erase it into "nobody checked".
   */
  it("stores a zero observation as zero, not as unchecked", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await recordPromise(kase.id, userId, { promisedShekels: 3_000 }, daysAgo(90));
    const v = await checkPromise(kase.id, userId, 0, NOW);
    expect(v.observedMinor).toBe(0);
    expect(v.checkedAt).not.toBeNull();
    expect(v.verdict!.state).toBe("missing");
    expect(v.verdict!.shortfallMinor).toBe(300_000);
  });

  it("reports a partial credit as partial, not as settled", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await recordPromise(kase.id, userId, { promisedShekels: 3_000 }, daysAgo(90));
    const v = await checkPromise(kase.id, userId, 2_000, NOW);
    expect(v.verdict!.state).toBe("partial");
    expect(v.verdict!.shortfallMinor).toBe(100_000);
  });

  it("still creates no fee when the credit arrives", async () => {
    // Arrival is evidence, not accounting. The settle path takes the amount
    // from the person; deriving it here would be an invented mapping in the
    // fee path.
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await recordPromise(kase.id, userId, { promisedShekels: 3_000 }, daysAgo(90));
    await checkPromise(kase.id, userId, 3_000, NOW);
    expect(await prisma.fee.findUnique({ where: { caseId: kase.id } })).toBeNull();
    expect(await prisma.savingsProof.findUnique({ where: { caseId: kase.id } })).toBeNull();
  });

  it("refuses to check a case with no promise on it", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await expect(checkPromise(kase.id, userId, 100, NOW)).rejects.toMatchObject({
      code: "NO_PROMISE",
    });
  });

  it("will not let one account check another's promise", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const kase = await makeCase(owner);
    await recordPromise(kase.id, owner, { promisedShekels: 3_000 }, daysAgo(90));
    await expect(checkPromise(kase.id, stranger, 0, NOW)).rejects.toMatchObject({
      code: "NO_PROMISE",
    });
  });
});

suite("openPromises is what the dashboard should be asking about", () => {
  it("lists unchecked promises, the late ones first", async () => {
    const userId = await makeUser();
    const fresh = await makeCase(userId);
    const late = await makeCase(userId);
    await recordPromise(fresh.id, userId, { promisedShekels: 9_000 }, daysAgo(2));
    await recordPromise(late.id, userId, { promisedShekels: 100 }, daysAgo(GRACE_DAYS + 10));

    const open = await openPromises(userId, NOW);
    expect(open.map((p) => p.caseId)).toEqual([late.id, fresh.id]);
    expect(open[0].dueForCheck).toBe(true);
  });

  it("drops a promise once it has been checked", async () => {
    const userId = await makeUser();
    const kase = await makeCase(userId);
    await recordPromise(kase.id, userId, { promisedShekels: 3_000 }, daysAgo(90));
    expect(await openPromises(userId, NOW)).toHaveLength(1);
    await checkPromise(kase.id, userId, 3_000, NOW);
    expect(await openPromises(userId, NOW)).toHaveLength(0);
  });

  it("shows one account nothing of another's", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const kase = await makeCase(owner);
    await recordPromise(kase.id, owner, { promisedShekels: 3_000 }, daysAgo(90));
    expect(await openPromises(stranger, NOW)).toHaveLength(0);
  });
});

suite("how often a counterparty's promises turn into money", () => {
  /**
   * A complaint rate measures how often people were unhappy enough to write
   * in. This measures how often a company agreed to pay and then did not,
   * which is a different and much harder thing to explain away.
   */
  it("names a counterparty only once enough promises were actually checked", async () => {
    const userId = await makeUser();
    const provider = `testco_${tag}`;

    for (let i = 0; i < 3; i++) {
      const kase = await makeCase(userId, "SENT", provider);
      await recordPromise(kase.id, userId, { promisedShekels: 1_000 }, daysAgo(90));
      await checkPromise(kase.id, userId, 0, NOW);
    }
    expect((await brokenPromiseRates(NOW)).find((r) => r.counterparty === provider)).toBeUndefined();

    for (let i = 0; i < 2; i++) {
      const kase = await makeCase(userId, "SENT", provider);
      await recordPromise(kase.id, userId, { promisedShekels: 1_000 }, daysAgo(90));
      await checkPromise(kase.id, userId, 1_000, NOW);
    }
    const row = (await brokenPromiseRates(NOW)).find((r) => r.counterparty === provider);
    expect(row).toBeDefined();
    expect(row!.checked).toBe(5);
    expect(row!.broken).toBe(3);
    expect(row!.rate).toBeCloseTo(0.6);
  });

  /**
   * An unchecked promise measures our users' follow-through, not the
   * counterparty's. Counting it would make a company look better the less
   * anyone verified.
   */
  it("excludes unchecked promises from the denominator", async () => {
    const userId = await makeUser();
    const provider = `unchecked_${tag}`;
    for (let i = 0; i < 5; i++) {
      const kase = await makeCase(userId, "SENT", provider);
      await recordPromise(kase.id, userId, { promisedShekels: 1_000 }, daysAgo(90));
      if (i < 5) await checkPromise(kase.id, userId, 0, NOW);
    }
    // Five checked and broken, plus three nobody looked at.
    for (let i = 0; i < 3; i++) {
      const kase = await makeCase(userId, "SENT", provider);
      await recordPromise(kase.id, userId, { promisedShekels: 1_000 }, daysAgo(90));
    }
    const row = (await brokenPromiseRates(NOW)).find((r) => r.counterparty === provider);
    expect(row!.checked).toBe(5);
    expect(row!.rate).toBe(1);
  });
});
