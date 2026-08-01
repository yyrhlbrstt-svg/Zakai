import { describe, expect, it } from "vitest";
import {
  buildWatchList,
  summariseWatch,
  todaysAlert,
  shouldSuggestRescan,
  rescanAlertKey,
} from "./watch";
import { DEFAULT_PROFILE } from "../profile/store";

const NOW = new Date("2026-07-28T00:00:00Z");
const base = { profile: DEFAULT_PROFILE, now: NOW };

describe("a real countdown with nothing asked of anyone", () => {
  it("produces deadlines from an employed profile alone", () => {
    // No dates, no uploads, no questions beyond the eight taps already taken.
    const items = buildWatchList({
      ...base,
      eligible: [{ id: "tax_refund", yearlyMinor: 420_000 }],
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.basis === "tax_year")).toBe(true);
    expect(items.every((i) => i.expiresAt !== null)).toBe(true);
  });

  it("expands a tax right into one countdown per open year", () => {
    // A person is not owed one refund, they are owed up to six — and collapsing
    // them hides the only urgent one in the set.
    const items = buildWatchList({
      ...base,
      eligible: [{ id: "tax_refund", yearlyMinor: 100_000 }],
    });
    const years = items.map((i) => i.taxYear).sort();
    expect(new Set(years).size).toBe(items.length);
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("puts the oldest open year under the most time pressure", () => {
    const items = buildWatchList({
      ...base,
      eligible: [{ id: "tax_refund", yearlyMinor: 100_000 }],
    });
    const oldest = items.reduce((a, b) => ((a.taxYear ?? 0) < (b.taxYear ?? 0) ? a : b));
    const newest = items.reduce((a, b) => ((a.taxYear ?? 0) > (b.taxYear ?? 0) ? a : b));
    expect(oldest.daysLeft!).toBeLessThan(newest.daysLeft!);
  });
});

describe("it says where the date came from", () => {
  it("marks an inferred countdown as inferred", () => {
    const items = buildWatchList({ ...base, eligible: [{ id: "tax_refund", yearlyMinor: 1 }] });
    expect(items[0].basis).toBe("tax_year");
  });

  it("prefers a date the person actually gave us", () => {
    // Presenting an inference as a fact is how a countdown stops being believed.
    const items = buildWatchList({
      ...base,
      eligible: [{ id: "flight_comp", oneTimeMinor: 260_000 }],
      events: [{ rightId: "flight_comp", occurredAt: new Date("2024-03-02T00:00:00Z") }],
    });
    expect(items[0].basis).toBe("reported_event");
    expect(items[0].expiresAt!.toISOString().slice(0, 10)).toBe("2028-03-02");
  });

  it("stays silent about an event right with no date rather than assuming one", () => {
    // An assumed date produces an assumed deadline, and a deadline wrong in the
    // alarming direction is the one thing this cannot afford.
    const items = buildWatchList({
      ...base,
      eligible: [{ id: "flight_comp", oneTimeMinor: 260_000 }],
    });
    expect(items).toEqual([]);
  });
});

describe("it does not count what is already handled", () => {
  it("drops rights the person has acted on", () => {
    const eligible = [{ id: "tax_refund", yearlyMinor: 100_000 }];
    expect(buildWatchList({ ...base, eligible, actedOn: ["tax_refund"] })).toEqual([]);
  });

  it("ignores a right with no statutory clock", () => {
    expect(
      buildWatchList({ ...base, eligible: [{ id: "dormant_money", yearlyMinor: 500_000 }] }),
    ).toEqual([]);
  });

  it("ignores a right nobody has written a rule for", () => {
    expect(buildWatchList({ ...base, eligible: [{ id: "invented", yearlyMinor: 9 }] })).toEqual([]);
  });
});

describe("the summary a person actually sees", () => {
  const summary = summariseWatch({
    ...base,
    eligible: [
      { id: "tax_refund", yearlyMinor: 420_000 },
      { id: "work_grant", yearlyMinor: 300_000 },
    ],
  });

  it("totals only what disappears soon, not everything owed", () => {
    // The headline has to be money at risk. Money owed with four years left is
    // not at risk, and counting it manufactures the urgency this must not have.
    expect(summary.atRiskSoonMinor).toBeGreaterThanOrEqual(0);
    const soonOnly = summary.items
      .filter((i) => i.urgency === "critical" || i.urgency === "soon")
      .reduce((s, i) => s + i.valueAtRiskMinor, 0);
    expect(summary.atRiskSoonMinor).toBe(soonOnly);
  });

  it("names one most-urgent item, taken from the ranking rather than re-derived", () => {
    const live = summary.items.filter((i) => i.urgency !== "expired");
    expect(summary.mostUrgent).toEqual(live[0]);
  });

  it("returns nothing urgent when nothing is", () => {
    const quiet = summariseWatch({ ...base, eligible: [] });
    expect(quiet.mostUrgent).toBeNull();
    expect(quiet.alertable).toEqual([]);
    expect(todaysAlert(quiet)).toBeNull();
  });
});

describe("one alert or none — never a digest", () => {
  it("sends at most one thing, however much is pressing", () => {
    // A list of five deadlines is a newsletter, and a newsletter is ignored.
    const summary = summariseWatch({
      ...base,
      eligible: [
        { id: "tax_refund", yearlyMinor: 900_000 },
        { id: "work_grant", yearlyMinor: 800_000 },
        { id: "arnona_income", yearlyMinor: 700_000 },
      ],
    });
    const alert = todaysAlert(summary);
    expect(alert === null || typeof alert.rightId === "string").toBe(true);
    if (alert) expect(summary.alertable).toContain(alert);
  });

  it("never alerts about something already expired", () => {
    const summary = summariseWatch({
      ...base,
      eligible: [{ id: "tax_refund", yearlyMinor: 900_000 }],
    });
    for (const a of summary.alertable) expect(a.urgency).not.toBe("expired");
  });
});

describe("determinism", () => {
  it("gives the same watch list for the same day", () => {
    const args = { ...base, eligible: [{ id: "tax_refund", yearlyMinor: 100_000 }] };
    expect(buildWatchList(args)).toEqual(buildWatchList(args));
  });
});

describe("the re-scan nudge", () => {
  it("is overdue for someone who has never opened a case", () => {
    expect(shouldSuggestRescan(null, NOW)).toBe(true);
  });

  it("stays quiet right after a scan", () => {
    const lastWeek = new Date(NOW.getTime() - 7 * 86_400_000);
    expect(shouldSuggestRescan(lastWeek, NOW)).toBe(false);
  });

  it("stays quiet just under the idle threshold", () => {
    const notQuiteLongEnough = new Date(NOW.getTime() - 119 * 86_400_000);
    expect(shouldSuggestRescan(notQuiteLongEnough, NOW)).toBe(false);
  });

  it("is due once the idle threshold is crossed", () => {
    const longAgo = new Date(NOW.getTime() - 121 * 86_400_000);
    expect(shouldSuggestRescan(longAgo, NOW)).toBe(true);
  });

  it("keys the alert by calendar quarter, so it can repeat but not within one", () => {
    const q1 = new Date("2026-02-01T00:00:00Z");
    const q1Again = new Date("2026-03-20T00:00:00Z");
    const q2 = new Date("2026-04-01T00:00:00Z");
    expect(rescanAlertKey(q1)).toBe(rescanAlertKey(q1Again));
    expect(rescanAlertKey(q1)).not.toBe(rescanAlertKey(q2));
  });
});
