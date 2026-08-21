import { describe, expect, it } from "vitest";
import {
  GRACE_DAYS,
  TOLERANCE_MINOR,
  creditsFrom,
  outstandingMinor,
  reconcileCredit,
  unfulfilled,
  type PromisedCredit,
} from "./promisedCredit";
import type { RecurringCharge } from "./subscriptions";

const NOW = new Date("2026-08-08T00:00:00");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const promise = (over: Partial<PromisedCredit> = {}): PromisedCredit => ({
  counterparty: "cellcom",
  promisedMinor: 300_000, // ₪3,000
  promisedAt: daysAgo(90),
  dueBy: null,
  ...over,
});

describe("reconcileCredit", () => {
  it("confirms a credit that actually arrived", () => {
    const v = reconcileCredit(promise(), 300_000, NOW);
    expect(v.state).toBe("arrived");
    expect(v.shortfallMinor).toBe(0);
  });

  /**
   * The failure this exists to catch: a promise made on a call, written down,
   * and never checked against the statement it was supposed to appear on.
   */
  it("catches a promise that was never honoured", () => {
    const v = reconcileCredit(promise(), 0, NOW);
    expect(v.state).toBe("missing");
    expect(v.shortfallMinor).toBe(300_000);
  });

  it("reports a partial credit as partial, not as settled", () => {
    // Rounding this up to "arrived" would stop someone looking for ₪1,000
    // that is still owed.
    const v = reconcileCredit(promise(), 200_000, NOW);
    expect(v.state).toBe("partial");
    expect(v.shortfallMinor).toBe(100_000);
  });

  it("treats a few shekels short as arrived rather than a broken promise", () => {
    const v = reconcileCredit(promise(), 300_000 - TOLERANCE_MINOR, NOW);
    expect(v.state).toBe("arrived");
    expect(v.shortfallMinor).toBe(0);
  });

  it("does not call a promise broken before its date", () => {
    // Chasing early spends credibility on something that may be on track.
    const v = reconcileCredit(promise({ dueBy: daysAhead(10) }), 0, NOW);
    expect(v.state).toBe("pending");
  });

  it("calls it missing once the stated date has passed", () => {
    const v = reconcileCredit(promise({ dueBy: daysAgo(1) }), 0, NOW);
    expect(v.state).toBe("missing");
  });

  it("waits out the grace period when no date was given", () => {
    const early = reconcileCredit(
      promise({ promisedAt: daysAgo(GRACE_DAYS - 1), dueBy: null }),
      0,
      NOW,
    );
    expect(early.state).toBe("pending");

    const due = reconcileCredit(promise({ promisedAt: daysAgo(GRACE_DAYS), dueBy: null }), 0, NOW);
    expect(due.state).toBe("missing");
  });

  it("never turns an overpayment into a debt owed to them", () => {
    const v = reconcileCredit(promise(), 500_000, NOW);
    expect(v.shortfallMinor).toBe(0);
    expect(v.state).toBe("arrived");
  });

  it("keeps money in integer minor units", () => {
    const v = reconcileCredit(promise({ promisedMinor: 1_234.7 }), 1_000.4, NOW);
    expect(Number.isInteger(v.promisedMinor)).toBe(true);
    expect(Number.isInteger(v.observedMinor)).toBe(true);
    expect(Number.isInteger(v.shortfallMinor)).toBe(true);
  });

  it("reports how long the promise has been outstanding", () => {
    expect(reconcileCredit(promise({ promisedAt: daysAgo(45) }), 0, NOW).ageDays).toBe(45);
  });
});

describe("unfulfilled", () => {
  const v = (promisedMinor: number, credited: number) =>
    reconcileCredit(promise({ promisedMinor, promisedAt: daysAgo(90) }), credited, NOW);

  it("lists what is worth chasing, biggest shortfall first", () => {
    const small = v(50_000, 0);
    const big = v(400_000, 0);
    expect(unfulfilled([small, big])).toEqual([big, small]);
  });

  it("excludes promises that are still pending", () => {
    const pending = reconcileCredit(promise({ dueBy: daysAhead(30) }), 0, NOW);
    expect(unfulfilled([pending])).toEqual([]);
  });

  it("excludes credits that arrived", () => {
    expect(unfulfilled([v(300_000, 300_000)])).toEqual([]);
  });
});

describe("outstandingMinor", () => {
  it("totals only what is genuinely still owed", () => {
    const missing = reconcileCredit(promise({ promisedMinor: 100_000 }), 0, NOW);
    const partial = reconcileCredit(promise({ promisedMinor: 100_000 }), 40_000, NOW);
    const arrived = reconcileCredit(promise({ promisedMinor: 100_000 }), 100_000, NOW);
    expect(outstandingMinor([missing, partial, arrived])).toBe(100_000 + 60_000);
  });

  it("is zero when every promise was kept", () => {
    expect(outstandingMinor([reconcileCredit(promise(), 300_000, NOW)])).toBe(0);
  });
});

describe("creditsFrom", () => {
  const charge = (merchant: string, agorot: number): RecurringCharge => ({
    merchant,
    category: "other",
    monthlyAgorot: agorot,
    occurrences: 1,
    providerKey: null, confidence: 1,
    chargedOn: [],
  });

  it("sums only the named counterparty's lines", () => {
    const rows = [charge("סלקום", 50_000), charge("נטפליקס", 9_000)];
    expect(creditsFrom(rows, "סלקום")).toBe(50_000);
  });

  it("matches regardless of casing and spacing", () => {
    expect(creditsFrom([charge("Bank  Hapoalim", 10_000)], "bank hapoalim")).toBe(10_000);
  });

  it("is zero when that counterparty appears nowhere", () => {
    expect(creditsFrom([charge("סלקום", 50_000)], "partner")).toBe(0);
  });
});
