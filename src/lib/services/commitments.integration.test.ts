import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  CommitmentError,
  activeCommitments,
  addCommitment,
  asRecurringCharges,
  closingSoonAcrossUsers,
  endCommitment,
  reviewCommitments,
} from "./commitments";
import { CLOSING_SOON_DAYS } from "@/lib/noticeWindow";

/**
 * This decides whether somebody is told they can still get out of a contract,
 * so it runs against the real table rather than a mock that would agree with
 * whatever the code happens to do.
 *
 * Requires a live database; skipped without DATABASE_URL, like the other
 * integration suites.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const suite = hasDb ? describe : describe.skip;

const NOW = new Date("2026-08-09T12:00:00Z");
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const tag = `cm_${Math.random().toString(36).slice(2, 8)}`;
const userIds: string[] = [];

async function makeUser() {
  const u = await prisma.user.create({
    data: {
      email: `${tag}-${Math.random().toString(36).slice(2)}@zakai.test`,
      name: "Commitment Tester",
      phone: "+972500000000",
      passwordHash: "$2a$10$notarealhashnotarealhashnotarealhashnotarealhashno",
      referralCode: `rc_${Math.random().toString(36).slice(2, 10)}`,
    },
    select: { id: true },
  });
  userIds.push(u.id);
  return u.id;
}

afterAll(async () => {
  if (!hasDb) return;
  for (const id of userIds) await prisma.user.delete({ where: { id } }).catch(() => {});
});

suite("the record holds what a person is committed to", () => {
  it("keeps the money in integer agorot", async () => {
    const userId = await makeUser();
    const c = await addCommitment(userId, { label: "Netflix", monthlyShekels: 54.9 });
    expect(c.monthlyMinor).toBe(5_490);
    expect(Number.isInteger(c.monthlyMinor)).toBe(true);
  });

  /**
   * "We do not know what this costs" and "this costs nothing" are different
   * facts, and collapsing them would quietly drop a contract out of every
   * total the person is shown.
   */
  it("keeps an unpriced commitment distinguishable from a free one", async () => {
    const userId = await makeUser();
    await addCommitment(userId, { label: "office lease", monthlyShekels: null });
    await addCommitment(userId, { label: "free tier", monthlyShekels: 0 });

    const review = await reviewCommitments(userId, NOW);
    expect(review.unpriced).toBe(1);
    expect(review.monthlyTotalMinor).toBe(0);
  });

  it("refuses a commitment with no label, and a negative notice period", async () => {
    const userId = await makeUser();
    await expect(addCommitment(userId, { label: "   " })).rejects.toBeInstanceOf(CommitmentError);
    await expect(
      addCommitment(userId, { label: "x", noticeDays: -30 }),
    ).rejects.toBeInstanceOf(CommitmentError);
  });

  it("shows one account nothing of another's", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    await addCommitment(owner, { label: "private", monthlyShekels: 100 });
    expect(await activeCommitments(stranger, NOW)).toHaveLength(0);
  });
});

suite("the deadline is derived, never stored", () => {
  it("reports the date notice must be given, not the renewal date", async () => {
    const userId = await makeUser();
    const c = await addCommitment(userId, {
      label: "gym",
      renewsOn: new Date("2027-01-01"),
      noticeDays: 60,
    });
    expect(c.window.actBy?.toISOString().slice(0, 10)).toBe("2026-11-02");
  });

  /**
   * A customary notice period guessed here would produce a confident deadline
   * that is wrong, and somebody would plan around it.
   */
  it("says the deadline is unknown when the contract states no notice period", async () => {
    const userId = await makeUser();
    await addCommitment(userId, { label: "lease", renewsOn: new Date("2027-01-01") });

    const review = await reviewCommitments(userId, NOW);
    expect(review.unknownDeadline).toBe(1);
    expect(review.acting).toHaveLength(0);
  });

  it("surfaces a window that is closing, and one already missed", async () => {
    const userId = await makeUser();
    await addCommitment(userId, {
      label: "closing",
      renewsOn: daysAhead(CLOSING_SOON_DAYS + 3),
      noticeDays: 10,
    });
    await addCommitment(userId, {
      label: "missed",
      renewsOn: daysAhead(5),
      noticeDays: 60,
    });
    await addCommitment(userId, {
      label: "plenty of time",
      renewsOn: daysAhead(300),
      noticeDays: 30,
    });

    const review = await reviewCommitments(userId, NOW);
    // A passed deadline is the most important thing on the list, not noise to
    // filter out — the person still has to decide what to do about a term
    // that is now rolling.
    expect(review.acting.map((c) => c.label).sort()).toEqual(["closing", "missed"]);
  });
});

suite("the engines run over the record", () => {
  it("finds two vendors billed for one job", async () => {
    const userId = await makeUser();
    await addCommitment(userId, { label: "Dropbox", category: "digital", monthlyShekels: 50 });
    await addCommitment(userId, { label: "Google Drive", category: "digital", monthlyShekels: 30 });

    const review = await reviewCommitments(userId, NOW);
    expect(review.overlaps).toHaveLength(1);
    expect(review.overlaps[0].smallerMonthlyAgorot).toBe(3_000);
  });

  it("leaves an unpriced commitment out of the overlap maths", async () => {
    // Told a charge is free, an overlap finder ranks it last — the opposite
    // of true for a contract nobody has priced yet.
    const userId = await makeUser();
    await addCommitment(userId, { label: "Dropbox", category: "digital", monthlyShekels: 50 });
    await addCommitment(userId, { label: "Box", category: "digital", monthlyShekels: null });

    const items = await activeCommitments(userId, NOW);
    expect(asRecurringCharges(items)).toHaveLength(1);
    expect((await reviewCommitments(userId, NOW)).overlaps).toHaveLength(0);
  });

  it("only treats a registry-backed counterparty as a provider", async () => {
    const userId = await makeUser();
    await addCommitment(userId, { label: "phone", counterparty: "cellcom", monthlyShekels: 90 });
    await addCommitment(userId, { label: "misc", counterparty: "some local shop", monthlyShekels: 40 });

    const charges = asRecurringCharges(await activeCommitments(userId, NOW));
    expect(charges.find((c) => c.merchant === "phone")?.providerKey).toBe("cellcom");
    expect(charges.find((c) => c.merchant === "misc")?.providerKey).toBeNull();
  });
});

suite("ending a commitment keeps the record", () => {
  it("stops counting it without deleting it", async () => {
    const userId = await makeUser();
    const c = await addCommitment(userId, { label: "cancelled thing", monthlyShekels: 100 });
    await endCommitment(c.id, userId, NOW);

    expect(await activeCommitments(userId, NOW)).toHaveLength(0);
    // Still there — what somebody used to pay for is the half that proves a
    // cancellation actually happened.
    expect(await prisma.commitment.findUnique({ where: { id: c.id } })).not.toBeNull();
  });

  it("will not let one account end another's commitment", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const c = await addCommitment(owner, { label: "theirs", monthlyShekels: 10 });
    await expect(endCommitment(c.id, stranger, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

suite("the digest sees what the screen sees", () => {
  it("collects only the users with something to act on", async () => {
    const acting = await makeUser();
    const quiet = await makeUser();
    await addCommitment(acting, {
      label: "closing",
      renewsOn: daysAhead(CLOSING_SOON_DAYS + 2),
      noticeDays: 10,
    });
    await addCommitment(quiet, { label: "far off", renewsOn: daysAhead(300), noticeDays: 30 });

    const byUser = await closingSoonAcrossUsers(NOW);
    expect(byUser.has(acting)).toBe(true);
    expect(byUser.has(quiet)).toBe(false);
  });

  it("ignores commitments that have ended", async () => {
    const userId = await makeUser();
    const c = await addCommitment(userId, {
      label: "gone",
      renewsOn: daysAhead(CLOSING_SOON_DAYS + 2),
      noticeDays: 10,
    });
    await endCommitment(c.id, userId, NOW);
    expect((await closingSoonAcrossUsers(NOW)).has(userId)).toBe(false);
  });
});
