import { describe, expect, it } from "vitest";
import {
  SILENCE_AFTER_DAYS,
  buildCounterMemory,
  hasMemory,
  historyClaim,
  type OutreachRecord,
} from "./counterMemory";

const NOW = new Date("2026-08-07T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const rec = (over: Partial<OutreachRecord> = {}): OutreachRecord => ({
  counterparty: "cellcom",
  deliveredAt: daysAgo(40),
  repliedAt: null,
  saved: false,
  recoveredMinor: 0,
  ...over,
});

const only = (records: OutreachRecord[]) => buildCounterMemory(records, NOW)[0];

describe("buildCounterMemory", () => {
  /**
   * The failure this guards is not hypothetical: with no SMTP configured
   * every Outbox row stays QUEUED. Counting those as sent would tell people
   * they were ignored by companies that were never contacted — a false
   * accusation, written into their own records, at scale.
   */
  it("never calls a queued letter delivered", () => {
    const m = only([rec({ deliveredAt: null }), rec({ deliveredAt: null })]);
    expect(m.delivered).toBe(0);
    expect(m.undelivered).toBe(2);
    expect(m.ignored).toBe(0);
  });

  it("reports our own backlog separately from their silence", () => {
    const m = only([rec(), rec({ deliveredAt: null })]);
    expect(m.delivered).toBe(1);
    expect(m.undelivered).toBe(1);
    expect(m.ignored).toBe(1); // only the delivered one can be ignored
  });

  it("counts silence only after the window has actually passed", () => {
    const tooEarly = only([rec({ deliveredAt: daysAgo(SILENCE_AFTER_DAYS - 1) })]);
    expect(tooEarly.ignored).toBe(0);

    const longEnough = only([rec({ deliveredAt: daysAgo(SILENCE_AFTER_DAYS) })]);
    expect(longEnough.ignored).toBe(1);
  });

  it("does not call a replied letter ignored, however late the reply", () => {
    const m = only([rec({ deliveredAt: daysAgo(90), repliedAt: daysAgo(1) })]);
    expect(m.ignored).toBe(0);
    expect(m.replied).toBe(1);
  });

  it("measures how long they take, from delivery to reply", () => {
    const m = only([
      rec({ deliveredAt: daysAgo(40), repliedAt: daysAgo(30) }), // 10
      rec({ deliveredAt: daysAgo(60), repliedAt: daysAgo(40) }), // 20
      rec({ deliveredAt: daysAgo(80), repliedAt: daysAgo(50) }), // 30
    ]);
    expect(m.medianReplyDays).toBe(20);
  });

  it("has no reply time when nobody replied", () => {
    expect(only([rec()]).medianReplyDays).toBeNull();
  });

  it("keeps money in integer minor units", () => {
    const m = only([rec({ saved: true, recoveredMinor: 12_345 }), rec({ recoveredMinor: 55 })]);
    expect(m.recoveredMinor).toBe(12_400);
    expect(Number.isInteger(m.recoveredMinor)).toBe(true);
  });

  it("remembers which stance actually won here, most wins first", () => {
    const m = only([
      rec({ saved: true, variantId: "firm" }),
      rec({ saved: true, variantId: "firm" }),
      rec({ saved: true, variantId: "polite" }),
      rec({ saved: false, variantId: "polite" }),
    ]);
    expect(m.winningVariants).toEqual([
      { variantId: "firm", wins: 2 },
      { variantId: "polite", wins: 1 },
    ]);
  });

  it("does not credit a stance for a letter that never arrived", () => {
    const m = only([rec({ deliveredAt: null, saved: true, variantId: "firm" })]);
    expect(m.winningVariants).toEqual([]);
  });

  it("groups counterparties regardless of casing and spacing", () => {
    const all = buildCounterMemory(
      [rec({ counterparty: "Bank  Hapoalim" }), rec({ counterparty: "bank hapoalim" })],
      NOW,
    );
    expect(all).toHaveLength(1);
    expect(all[0].delivered).toBe(2);
  });

  it("orders by how much history there is", () => {
    const all = buildCounterMemory(
      [
        rec({ counterparty: "partner" }),
        rec({ counterparty: "cellcom" }),
        rec({ counterparty: "cellcom" }),
      ],
      NOW,
    );
    expect(all.map((m) => m.counterparty)).toEqual(["cellcom", "partner"]);
  });

  it("records the span of the relationship", () => {
    const m = only([rec({ deliveredAt: daysAgo(200) }), rec({ deliveredAt: daysAgo(10) })]);
    expect(m.firstContactAt).toEqual(daysAgo(200));
    expect(m.lastContactAt).toEqual(daysAgo(10));
  });

  it("is empty for no records, and skips blank counterparties", () => {
    expect(buildCounterMemory([], NOW)).toEqual([]);
    expect(buildCounterMemory([rec({ counterparty: "   " })], NOW)).toEqual([]);
  });
});

describe("historyClaim", () => {
  it("leads with their own silence, which is hardest to dispute", () => {
    const claim = historyClaim(only([rec(), rec()]));
    expect(claim).toEqual({ kind: "ignored_before", counterparty: "cellcom", count: 2 });
  });

  it("falls back to how slow they are when they did eventually reply", () => {
    const m = only([
      rec({ deliveredAt: daysAgo(90), repliedAt: daysAgo(50) }), // 40 days
      rec({ deliveredAt: daysAgo(80), repliedAt: daysAgo(40) }), // 40 days
    ]);
    const claim = historyClaim(m);
    expect(claim?.kind).toBe("slow_to_reply");
    expect(claim?.medianReplyDays).toBe(40);
  });

  it("does not call a prompt reply slow", () => {
    const m = only([rec({ deliveredAt: daysAgo(40), repliedAt: daysAgo(38) })]);
    expect(historyClaim(m)?.kind).not.toBe("slow_to_reply");
  });

  it("mentions a past resolution when there is nothing to complain about", () => {
    const m = only([rec({ deliveredAt: daysAgo(40), repliedAt: daysAgo(39), saved: true })]);
    expect(historyClaim(m)).toEqual({
      kind: "resolved_before",
      counterparty: "cellcom",
      count: 1,
    });
  });

  it("says nothing when the history supports nothing", () => {
    // Delivered yesterday, no reply yet: too early to claim anything at all.
    expect(historyClaim(only([rec({ deliveredAt: daysAgo(1) })]))).toBeNull();
  });

  it("says nothing when every letter is still queued", () => {
    expect(historyClaim(only([rec({ deliveredAt: null })]))).toBeNull();
  });
});

describe("hasMemory", () => {
  it("is true once anything has been attempted", () => {
    expect(hasMemory(only([rec({ deliveredAt: null })]))).toBe(true);
    expect(hasMemory(only([rec()]))).toBe(true);
  });
});
