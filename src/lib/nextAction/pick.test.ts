import { describe, expect, it } from "vitest";
import { pickNext, rankAll, type Candidate } from "./pick";

function c(over: Partial<Candidate> & { id: string }): Candidate {
  return {
    kind: "one_off",
    href: "/x",
    valueMinor: 100_000,
    daysLeft: null,
    absolute: false,
    ...over,
  };
}

describe("it answers with one thing, not a menu", () => {
  it("returns a single action however many are open", () => {
    // Sixty-four links in the nav is the bug. Iyengar and Lepper measured the
    // effect: twenty-four jams drew more attention than six and converted at
    // about a tenth of the rate. Choice attracts; it does not act.
    const many = Array.from({ length: 40 }, (_, i) => c({ id: `a${i}`, valueMinor: 1000 * i }));
    const next = pickNext(many)!;
    expect(next.candidate).toBeDefined();
    expect(next.runnersUp.length).toBeLessThanOrEqual(4);
  });

  it("reports how many are open so progress can be framed honestly", () => {
    const next = pickNext([c({ id: "a" }), c({ id: "b" }), c({ id: "c" })])!;
    expect(next.totalOpen).toBe(3);
    expect(next.step).toBe(1);
  });

  it("returns nothing rather than inventing something to click", () => {
    // A money app that always has something for you is one that has started
    // making things up, and the first invented item is the last believed one.
    expect(pickNext([])).toBeNull();
    expect(pickNext([c({ id: "a", done: true })])).toBeNull();
    expect(pickNext([c({ id: "a", valueMinor: 0 })])).toBeNull();
  });

  it("never suggests something already acted on", () => {
    const next = pickNext([c({ id: "done", valueMinor: 900_000, done: true }), c({ id: "live" })])!;
    expect(next.candidate.id).toBe("live");
  });

  it("never suggests what has already expired", () => {
    // Nothing can be done, so surfacing it is pure distress.
    const next = pickNext([
      c({ id: "gone", daysLeft: -3, valueMinor: 900_000, absolute: true }),
      c({ id: "live" }),
    ])!;
    expect(next.candidate.id).toBe("live");
  });
});

describe("ranking weighs a real clock against a real sum", () => {
  it("does not let a trivial claim win on nearness alone", () => {
    const next = pickNext([
      c({ id: "tiny_tomorrow", daysLeft: 1, valueMinor: 5_000, absolute: true }),
      c({ id: "big_in_three_weeks", daysLeft: 21, valueMinor: 800_000, absolute: true }),
    ])!;
    expect(next.candidate.id).toBe("big_in_three_weeks");
  });

  it("does not let a distant fortune outrank a near, real sum", () => {
    // Loss aversion is only permitted to reorder true things: one of these
    // genuinely stops existing and the other genuinely does not.
    const next = pickNext([
      c({ id: "big_far", daysLeft: 1400, valueMinor: 800_000, absolute: true }),
      c({ id: "real_soon", daysLeft: 9, valueMinor: 60_000, absolute: true }),
    ])!;
    expect(next.candidate.id).toBe("real_soon");
  });

  it("cannot let a clockless item displace a comparable deadline", () => {
    // The property that stops the ranking inventing urgency to win an argument.
    const next = pickNext([
      c({ id: "no_clock", daysLeft: null, valueMinor: 100_000 }),
      c({ id: "with_clock", daysLeft: 30, valueMinor: 100_000, absolute: true }),
    ])!;
    expect(next.candidate.id).toBe("with_clock");
  });

  it("does not divide by zero on something due today", () => {
    const next = pickNext([c({ id: "today", daysLeft: 0, valueMinor: 1_000, absolute: true })])!;
    expect(Number.isFinite(next.candidate.valueMinor)).toBe(true);
    expect(next.candidate.id).toBe("today");
  });

  it("is a total order — the same facts give the same screen twice", () => {
    const set = [c({ id: "zeta" }), c({ id: "alpha" }), c({ id: "mid" })];
    const a = pickNext(set)!.candidate.id;
    const b = pickNext([...set].reverse())!.candidate.id;
    expect(a).toBe(b);
    expect(rankAll(set).map((x) => x.id)).toEqual(rankAll([...set].reverse()).map((x) => x.id));
  });
});

describe("the reason is checkable, not a slogan", () => {
  it("says expiring only when there is an absolute date inside the window", () => {
    expect(pickNext([c({ id: "a", daysLeft: 20, absolute: true })])!.because).toBe("expiring");
  });

  it("does not claim expiring for a soft administrative date", () => {
    // A missed prescriptive date destroys money; a missed administrative one is
    // an inconvenience, and shouting equally about both ends the credibility.
    expect(pickNext([c({ id: "a", daysLeft: 20, absolute: false })])!.because).not.toBe("expiring");
  });

  it("does not claim expiring for a date far out", () => {
    expect(pickNext([c({ id: "a", daysLeft: 900, absolute: true })])!.because).not.toBe("expiring");
  });

  it("calls a monthly overpay what it is", () => {
    expect(pickNext([c({ id: "a", kind: "recurring" })])!.because).toBe("bleeding");
  });

  it("uses the closed set and nothing else", () => {
    const allowed = ["expiring", "bleeding", "largest", "quickest"];
    for (const kind of ["deadline", "recurring", "disclosure", "event", "one_off"] as const) {
      const n = pickNext([c({ id: "a", kind })]);
      if (n) expect(allowed).toContain(n.because);
    }
  });
});

describe("the categories with no honest figure still get a turn", () => {
  it("keeps a disclosure candidate that has no value attached", () => {
    // A dormant account is nine shekels or ninety thousand and only the holder
    // can see which. Zero value must not mean zero priority.
    const next = pickNext([c({ id: "dormant", kind: "disclosure", valueMinor: 0 })]);
    expect(next?.candidate.id).toBe("dormant");
  });

  it("keeps an event candidate with no value attached", () => {
    expect(pickNext([c({ id: "injury", kind: "event", valueMinor: 0 })])?.candidate.id).toBe("injury");
  });

  it("drops a valueless candidate that is neither", () => {
    expect(pickNext([c({ id: "empty", kind: "one_off", valueMinor: 0 })])).toBeNull();
  });
});

describe("the full list stays available without being the default", () => {
  it("ranks everything open", () => {
    const list = rankAll([c({ id: "a", valueMinor: 10 }), c({ id: "b", valueMinor: 900_000 })]);
    expect(list.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("excludes what is done", () => {
    expect(rankAll([c({ id: "a", done: true })])).toEqual([]);
  });

  it("does not mutate its input", () => {
    const input = [c({ id: "b" }), c({ id: "a" })];
    const before = input.map((x) => x.id);
    rankAll(input);
    expect(input.map((x) => x.id)).toEqual(before);
  });
});
