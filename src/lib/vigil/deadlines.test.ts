import { describe, expect, it } from "vitest";
import {
  IL_DEADLINES,
  countdownFor,
  clockStartDate,
  expiresAt,
  rankByMoneyAtRisk,
  ruleFor,
  urgencyOf,
  worthInterrupting,
  type Countdown,
} from "./deadlines";

const NOW = new Date("2026-07-28T00:00:00Z");

function cd(over: Partial<Countdown>): Countdown {
  return {
    rightId: "x",
    expiresAt: new Date("2026-08-28T00:00:00Z"),
    daysLeft: 31,
    urgency: "soon",
    valueAtRiskMinor: 100_000,
    absolute: true,
    source: "test",
    ...over,
  };
}

describe("the clock starts where the law says, not where it is convenient", () => {
  it("runs a tax right from the end of the tax year, not the transaction", () => {
    // Getting this wrong tells someone they have weeks when they have months.
    const rule = ruleFor("tax_refund")!;
    const start = clockStartDate(rule, new Date("2021-03-15T00:00:00Z"));
    expect(start.toISOString().slice(0, 10)).toBe("2021-12-31");
    expect(expiresAt(rule, new Date("2021-03-15T00:00:00Z"))!.getUTCFullYear()).toBe(2027);
  });

  it("runs an event right from the event", () => {
    const rule = ruleFor("flight_comp")!;
    const expiry = expiresAt(rule, new Date("2024-05-01T00:00:00Z"))!;
    expect(expiry.toISOString().slice(0, 10)).toBe("2028-05-01");
  });

  it("handles a short window in days", () => {
    const rule = ruleFor("consumer_cancel14")!;
    const expiry = expiresAt(rule, new Date("2026-07-20T00:00:00Z"))!;
    expect(expiry.toISOString().slice(0, 10)).toBe("2026-08-03");
  });

  it("returns no expiry for a standing entitlement", () => {
    expect(expiresAt(ruleFor("dormant_money")!, NOW)).toBeNull();
  });
});

describe("it never invents urgency", () => {
  it("records an uncertain period as none rather than guessing", () => {
    // Manufacturing a deadline is the manipulation this feature would be
    // accused of, and the fastest way to lose the right to notify anyone.
    const standing = IL_DEADLINES.filter((r) => r.period.kind === "none");
    expect(standing.length).toBeGreaterThan(0);
    for (const r of standing) expect(r.absolute).toBe(false);
  });

  it("cites a statute for every rule, including the ones with no clock", () => {
    for (const r of IL_DEADLINES) expect(r.source.trim().length).toBeGreaterThan(8);
  });

  it("has no duplicate rules to disagree with each other", () => {
    const ids = IL_DEADLINES.map((r) => r.rightId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("urgency", () => {
  it("maps the bands", () => {
    expect(urgencyOf(null)).toBe("no_deadline");
    expect(urgencyOf(-1)).toBe("expired");
    expect(urgencyOf(0)).toBe("critical");
    expect(urgencyOf(30)).toBe("critical");
    expect(urgencyOf(31)).toBe("soon");
    expect(urgencyOf(90)).toBe("soon");
    expect(urgencyOf(91)).toBe("ample");
  });

  it("counts down against a real date", () => {
    const c = countdownFor(ruleFor("consumer_cancel14")!, new Date("2026-07-20T00:00:00Z"), 30_000, NOW);
    expect(c.daysLeft).toBe(6);
    expect(c.urgency).toBe("critical");
    expect(c.valueAtRiskMinor).toBe(30_000);
  });

  it("reports what was already lost rather than hiding it", () => {
    const c = countdownFor(ruleFor("consumer_cancel14")!, new Date("2026-01-01T00:00:00Z"), 30_000, NOW);
    expect(c.urgency).toBe("expired");
    expect(c.daysLeft).toBeLessThan(0);
  });
});

describe("ranking is by money about to be lost per day of runway", () => {
  it("does not let a trivial claim outrank a large one on nearness alone", () => {
    const ranked = rankByMoneyAtRisk([
      cd({ rightId: "tiny_tomorrow", daysLeft: 1, valueAtRiskMinor: 5_000, urgency: "critical" }),
      cd({ rightId: "big_in_three_weeks", daysLeft: 21, valueAtRiskMinor: 800_000, urgency: "critical" }),
    ]);
    expect(ranked[0].rightId).toBe("big_in_three_weeks");
  });

  it("does not let a distant fortune outrank a near, real sum", () => {
    const ranked = rankByMoneyAtRisk([
      cd({ rightId: "big_in_four_years", daysLeft: 1460, valueAtRiskMinor: 800_000, urgency: "ample" }),
      cd({ rightId: "real_in_nine_days", daysLeft: 9, valueAtRiskMinor: 60_000, urgency: "critical" }),
    ]);
    expect(ranked[0].rightId).toBe("real_in_nine_days");
  });

  it("puts what is already lost last, and keeps it", () => {
    const ranked = rankByMoneyAtRisk([
      cd({ rightId: "gone", daysLeft: -5, urgency: "expired", valueAtRiskMinor: 900_000 }),
      cd({ rightId: "live", daysLeft: 40, valueAtRiskMinor: 10_000 }),
    ]);
    expect(ranked.map((r) => r.rightId)).toEqual(["live", "gone"]);
  });

  it("does not divide by zero on something due today", () => {
    const ranked = rankByMoneyAtRisk([cd({ daysLeft: 0, valueAtRiskMinor: 1_000 })]);
    expect(Number.isFinite(ranked[0].valueAtRiskMinor)).toBe(true);
  });

  it("is stable when two items carry identical pressure", () => {
    const a = rankByMoneyAtRisk([cd({ rightId: "zeta" }), cd({ rightId: "alpha" })]);
    const b = rankByMoneyAtRisk([cd({ rightId: "alpha" }), cd({ rightId: "zeta" })]);
    expect(a.map((x) => x.rightId)).toEqual(b.map((x) => x.rightId));
  });
});

describe("the right to interrupt is spent, not owned", () => {
  it("stays quiet about small money", () => {
    // Pinging about a trivial claim teaches people to ignore the one that matters.
    expect(worthInterrupting(cd({ valueAtRiskMinor: 1_200 }))).toBe(false);
  });

  it("stays quiet when there is no hard deadline", () => {
    expect(worthInterrupting(cd({ absolute: false }))).toBe(false);
    expect(worthInterrupting(cd({ urgency: "no_deadline", daysLeft: null }))).toBe(false);
  });

  it("stays quiet when there is still ample time", () => {
    expect(worthInterrupting(cd({ urgency: "ample", daysLeft: 800 }))).toBe(false);
  });

  it("stays quiet about what is already gone", () => {
    // Nothing can be done, so an alert is pure distress.
    expect(worthInterrupting(cd({ urgency: "expired", daysLeft: -3 }))).toBe(false);
  });

  it("speaks up for real money inside a window where acting still works", () => {
    expect(worthInterrupting(cd({ urgency: "critical", daysLeft: 12, valueAtRiskMinor: 420_000 }))).toBe(true);
  });
});

describe("what a chat assistant cannot do", () => {
  it("knows the date the money dies, from facts a conversation never holds", () => {
    // The whole reason this is not replaceable by asking an AI: it needs the
    // person's dates, kept over time, checked without being asked.
    const flight = countdownFor(ruleFor("flight_comp")!, new Date("2023-02-11T00:00:00Z"), 350_000, NOW);
    expect(flight.expiresAt!.toISOString().slice(0, 10)).toBe("2027-02-11");
    expect(flight.daysLeft).toBeGreaterThan(0);
    expect(flight.source).toContain("התיישנות");
  });
});
