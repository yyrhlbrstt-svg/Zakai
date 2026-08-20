import { describe, expect, it } from "vitest";
import {
  computeStatuteConcentration,
  DEFAULT_MAX_STATUTE_SHARE,
  DEFAULT_MIN_CASES_FOR_ALERT,
} from "./concentration";
import { rightIdForVertical } from "./registry";

const RIGHT_31A = "il.consumer.31a.continued-billing-after-cancellation";

describe("rightIdForVertical — the single mapping source", () => {
  it("maps the statutory-cancel vertical and nothing else (today)", () => {
    expect(rightIdForVertical("subscription")).toBe(RIGHT_31A);
    expect(rightIdForVertical("telecom")).toBeNull();
    expect(rightIdForVertical("parking")).toBeNull();
  });
});

describe("computeStatuteConcentration", () => {
  it("computes shares over MAPPED cases only, reporting the unmapped as a number", () => {
    const report = computeStatuteConcentration([
      { vertical: "subscription", count: 30 },
      { vertical: "telecom", count: 70 }, // unmapped — must not dilute the share
    ]);
    expect(report.totalMapped).toBe(30);
    expect(report.totalUnmapped).toBe(70);
    expect(report.shares).toHaveLength(1);
    expect(report.shares[0]).toMatchObject({ rightId: RIGHT_31A, count: 30, share: 1 });
    // 100% of mapped — a breach at full sample, NOT diluted to 30% by unmapped.
    expect(report.breaches).toHaveLength(1);
  });

  it("suppresses alerts (not the report) below the minimum sample", () => {
    const report = computeStatuteConcentration([{ vertical: "subscription", count: 3 }]);
    expect(report.belowSample).toBe(true);
    expect(report.shares[0].share).toBe(1);
    expect(report.breaches).toHaveLength(0);
    expect(report.minCasesForAlert).toBe(DEFAULT_MIN_CASES_FOR_ALERT);
  });

  it("no breach at or under the ceiling", () => {
    // Ceiling is a strict bound: exactly maxShare is compliant.
    const report = computeStatuteConcentration([{ vertical: "subscription", count: 50 }], {
      maxShare: 1,
    });
    expect(report.breaches).toHaveLength(0);
  });

  it("carries the statute name and section so the report reads without a lookup", () => {
    const report = computeStatuteConcentration([{ vertical: "subscription", count: 20 }]);
    expect(report.shares[0].statuteName).toContain("חוק הגנת הצרכן");
    expect(report.shares[0].statuteSection).toContain("31א");
  });

  it("handles an empty book honestly — zeros, no shares, no breaches", () => {
    const report = computeStatuteConcentration([]);
    expect(report).toMatchObject({
      totalMapped: 0,
      totalUnmapped: 0,
      shares: [],
      breaches: [],
      maxShare: DEFAULT_MAX_STATUTE_SHARE,
    });
  });

  it("ignores non-positive counts rather than corrupting totals", () => {
    const report = computeStatuteConcentration([
      { vertical: "subscription", count: 0 },
      { vertical: "subscription", count: -5 },
      { vertical: "subscription", count: 12 },
    ]);
    expect(report.totalMapped).toBe(12);
  });
});
