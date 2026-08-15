import { describe, expect, it } from "vitest";
import { chargesDueWithin, estimateNextCharge } from "./nextCharge";

const d = (iso: string) => new Date(`${iso}T00:00:00`);
const NOW = d("2026-08-07");

describe("estimateNextCharge", () => {
  it("names the next monthly charge from three clean months", () => {
    const e = estimateNextCharge([d("2026-05-14"), d("2026-06-14"), d("2026-07-14")], NOW);
    expect(e).not.toBeNull();
    expect(e!.cycle).toBe("monthly");
    // Gaps of 31 and 30 days: median 30.5, rounded to 31. Jul 14 + 31 = Aug 14,
    // which is also the same-day-next-month answer a reader would expect.
    expect(e!.nextChargeAt.toISOString().slice(0, 10)).toBe("2026-08-14");
    expect(e!.confidence).toBe("high");
  });

  it("counts the days until it, which is the number that drives the decision", () => {
    const e = estimateNextCharge([d("2026-06-14"), d("2026-07-14")], NOW)!;
    // 2026-08-13 from 2026-08-07.
    expect(e.daysUntil).toBe(6);
  });

  /**
   * Two charges give exactly one gap, and one gap agrees with nothing. It may
   * be a real cycle or a coincidence, and the difference is invisible — so it
   * is never sold as confident.
   */
  it("is never confident from only two charges", () => {
    const e = estimateNextCharge([d("2026-06-14"), d("2026-07-14")], NOW)!;
    expect(e.confidence).toBe("low");
  });

  it("drops confidence when the gaps disagree", () => {
    // 30 then 37 days: a cycle, but a sloppy one.
    const e = estimateNextCharge([d("2026-05-14"), d("2026-06-13"), d("2026-07-20")], NOW)!;
    expect(e.cycle).toBe("monthly");
    expect(e.confidence).toBe("low");
  });

  it("refuses to invent a cadence from erratic gaps", () => {
    // 3 days then 31 — averaging these into "17 days" would be a fiction.
    expect(estimateNextCharge([d("2026-06-01"), d("2026-06-04"), d("2026-07-05")], NOW)).toBeNull();
  });

  it("says nothing from a single charge", () => {
    expect(estimateNextCharge([d("2026-07-14")], NOW)).toBeNull();
    expect(estimateNextCharge([], NOW)).toBeNull();
  });

  it("ignores same-day duplicates rather than reading them as a cycle", () => {
    // A split payment on one day must not become a 0-day interval.
    const e = estimateNextCharge(
      [d("2026-06-14"), d("2026-06-14"), d("2026-07-14"), d("2026-08-14")],
      NOW,
    );
    expect(e!.cycle).toBe("monthly");
  });

  it("rolls a stale statement forward to a future date, not a past one", () => {
    // Uploaded months late: the useful answer is the NEXT charge, not one that
    // already happened — a past date would read as "you have already missed it".
    const e = estimateNextCharge([d("2026-01-10"), d("2026-02-10"), d("2026-03-10")], NOW)!;
    expect(e.nextChargeAt.getTime()).toBeGreaterThanOrEqual(d("2026-08-07").getTime());
    expect(e.daysUntil).toBeGreaterThanOrEqual(0);
  });

  it("recognises weekly, quarterly and yearly cycles", () => {
    expect(
      estimateNextCharge([d("2026-07-01"), d("2026-07-08"), d("2026-07-15")], NOW)!.cycle,
    ).toBe("weekly");
    expect(
      estimateNextCharge([d("2026-01-05"), d("2026-04-05"), d("2026-07-05")], NOW)!.cycle,
    ).toBe("quarterly");
    expect(estimateNextCharge([d("2024-08-20"), d("2025-08-20")], NOW)!.cycle).toBe("yearly");
  });

  it("handles a charge due today as zero days, not negative", () => {
    const e = estimateNextCharge([d("2026-06-08"), d("2026-07-08")], NOW)!;
    expect(e.daysUntil).toBe(0);
    expect(e.nextChargeAt.toISOString().slice(0, 10)).toBe("2026-08-07");
  });

  it("survives invalid dates in the input instead of producing NaN", () => {
    const e = estimateNextCharge(
      [new Date("nonsense"), d("2026-06-14"), d("2026-07-14")],
      NOW,
    );
    expect(e).not.toBeNull();
    expect(Number.isNaN(e!.daysUntil)).toBe(false);
  });

  it("reports the last charge it actually saw", () => {
    const e = estimateNextCharge([d("2026-05-14"), d("2026-07-14"), d("2026-06-14")], NOW)!;
    expect(e.lastChargeAt.toISOString().slice(0, 10)).toBe("2026-07-14");
  });
});

describe("chargesDueWithin", () => {
  const make = (iso: string[]) => ({ next: estimateNextCharge(iso.map(d), NOW) });

  it("returns only what lands inside the window, soonest first", () => {
    const soon = make(["2026-06-09", "2026-07-09"]); // next 2026-08-08 → 1 day
    const later = make(["2026-06-25", "2026-07-25"]); // next 2026-08-24 → 17 days
    const items = chargesDueWithin([later, soon], 7);
    expect(items).toHaveLength(1);
    expect(items[0]).toBe(soon);
  });

  it("keeps them ordered by urgency", () => {
    const a = make(["2026-06-20", "2026-07-20"]); // next Aug 19 → 12 days
    const b = make(["2026-06-09", "2026-07-09"]); // 1 day
    expect(chargesDueWithin([a, b], 30).map((x) => x.next!.daysUntil)).toEqual([1, 12]);
  });

  it("skips charges with no estimate at all", () => {
    expect(chargesDueWithin([{ next: null }, make(["2026-06-09", "2026-07-09"])], 30)).toHaveLength(
      1,
    );
  });

  it("is empty when nothing is due soon", () => {
    expect(chargesDueWithin([make(["2026-06-25", "2026-07-25"])], 3)).toEqual([]);
  });
});
