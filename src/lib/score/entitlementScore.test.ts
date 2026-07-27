import { describe, expect, it } from "vitest";
import {
  bandFor,
  computeEntitlementScore,
  nextBestAction,
  type EntitlementScoreInput,
} from "./entitlementScore";

const base: EntitlementScoreInput = {
  eligible: [],
  actedOn: [],
  recovered: [],
  recoveredMinor: 0,
  profileCompleteness: 1,
};

const rights = [
  { id: "big", yearlyMinor: 400_000 },
  { id: "medium", yearlyMinor: 50_000 },
  { id: "small", yearlyMinor: 5_000 },
  { id: "varies" }, // real, but no honest figure
];

describe("the headline number", () => {
  it("reports what is still unclaimed, in money", () => {
    const r = computeEntitlementScore({ ...base, eligible: rights });
    expect(r.unclaimedMinor).toBe(455_000);
    expect(r.capturedMinor).toBe(0);
  });

  it("moves money from unclaimed to captured when a right is acted on", () => {
    const r = computeEntitlementScore({ ...base, eligible: rights, actedOn: ["big"] });
    expect(r.capturedMinor).toBe(400_000);
    expect(r.unclaimedMinor).toBe(55_000);
  });

  it("never invents a figure for an unquantified right", () => {
    const r = computeEntitlementScore({ ...base, eligible: [{ id: "varies" }] });
    expect(r.unclaimedMinor).toBe(0);
    expect(r.unquantifiedCount).toBe(1);
    // It is still a real entitlement and must still be surfaced.
    expect(r.gaps.map((g) => g.rightId)).toEqual(["varies"]);
    expect(r.gaps[0].unquantified).toBe(true);
  });

  it("counts a one-off at face value alongside recurring value", () => {
    const r = computeEntitlementScore({
      ...base,
      eligible: [{ id: "grant", oneTimeMinor: 120_000 }, { id: "annual", yearlyMinor: 30_000 }],
    });
    expect(r.unclaimedMinor).toBe(150_000);
  });
});

describe("coverage is weighted by money, not by count", () => {
  it("does not call three small wins and one big miss 'mostly covered'", () => {
    const r = computeEntitlementScore({
      ...base,
      eligible: rights,
      actedOn: ["medium", "small", "varies"],
    });
    // 3 of 4 by count, but only 55,000 of 455,000 by value.
    expect(r.actedOnCount).toBe(3);
    const coverage = r.components.find((c) => c.key === "coverage")!;
    expect(coverage.points).toBeLessThan(coverage.max * 0.2);
  });

  it("rewards the single big claim over several small ones", () => {
    const bigOnly = computeEntitlementScore({ ...base, eligible: rights, actedOn: ["big"] });
    const restOnly = computeEntitlementScore({
      ...base,
      eligible: rights,
      actedOn: ["medium", "small", "varies"],
    });
    expect(bigOnly.score).toBeGreaterThan(restOnly.score);
  });

  it("falls back to counting when nothing in the set is quantified", () => {
    const r = computeEntitlementScore({
      ...base,
      eligible: [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
      actedOn: ["a", "b"],
    });
    const coverage = r.components.find((c) => c.key === "coverage")!;
    expect(coverage.points).toBe(Math.round(0.5 * coverage.max));
  });
});

describe("recovery has a denominator", () => {
  it("does not let one windfall max the component for someone still leaking", () => {
    const r = computeEntitlementScore({
      ...base,
      eligible: rights,
      actedOn: ["small"],
      recoveredMinor: 5_000_000, // absurdly large
    });
    const recovery = r.components.find((c) => c.key === "recovery")!;
    expect(recovery.points).toBe(recovery.max);
    // But coverage is still near the floor, so the overall score cannot be high.
    expect(r.score).toBeLessThan(500);
  });

  it("is zero when nothing has been claimed yet", () => {
    const r = computeEntitlementScore({ ...base, eligible: rights, recoveredMinor: 999 });
    expect(r.components.find((c) => c.key === "recovery")!.points).toBe(0);
  });
});

describe("the score does not reward paying us", () => {
  it("has no plan, tier, referral or recency input at all", () => {
    const keys = Object.keys(base).sort();
    expect(keys).toEqual([
      "actedOn",
      "eligible",
      "profileCompleteness",
      "recovered",
      "recoveredMinor",
    ]);
  });

  it("only rises when money moves toward the user", () => {
    const before = computeEntitlementScore({ ...base, eligible: rights });
    const after = computeEntitlementScore({
      ...base,
      eligible: rights,
      actedOn: ["big"],
      recoveredMinor: 400_000,
    });
    expect(after.score).toBeGreaterThan(before.score);
  });
});

describe("what to do next", () => {
  it("puts the most valuable gap first", () => {
    const r = computeEntitlementScore({ ...base, eligible: rights });
    expect(nextBestAction(r)!.rightId).toBe("big");
  });

  it("ranks unquantified rights last rather than dropping them", () => {
    const r = computeEntitlementScore({ ...base, eligible: rights });
    expect(r.gaps.map((g) => g.rightId)).toEqual(["big", "medium", "small", "varies"]);
  });

  it("is deterministic when two gaps are worth the same", () => {
    const tie = [{ id: "zeta", yearlyMinor: 1000 }, { id: "alpha", yearlyMinor: 1000 }];
    const a = computeEntitlementScore({ ...base, eligible: tie });
    const b = computeEntitlementScore({ ...base, eligible: [...tie].reverse() });
    expect(a.gaps.map((g) => g.rightId)).toEqual(b.gaps.map((g) => g.rightId));
  });

  it("returns nothing to do when everything is captured", () => {
    const r = computeEntitlementScore({
      ...base,
      eligible: rights,
      actedOn: rights.map((x) => x.id),
    });
    expect(nextBestAction(r)).toBeNull();
    expect(r.unclaimedMinor).toBe(0);
  });
});

describe("bands describe the situation, not the person", () => {
  it("maps the range", () => {
    expect(bandFor(0)).toBe("leaking");
    expect(bandFor(199)).toBe("leaking");
    expect(bandFor(200)).toBe("starting");
    expect(bandFor(499)).toBe("starting");
    expect(bandFor(500)).toBe("catching_up");
    expect(bandFor(799)).toBe("catching_up");
    expect(bandFor(800)).toBe("covered");
    expect(bandFor(1000)).toBe("covered");
  });

  it("a fully captured, fully recovered, fully profiled user maxes out", () => {
    const r = computeEntitlementScore({
      eligible: rights,
      actedOn: rights.map((x) => x.id),
      recovered: rights.map((x) => x.id),
      recoveredMinor: 455_000,
      profileCompleteness: 1,
    });
    expect(r.score).toBe(1000);
    expect(r.band).toBe("covered");
  });
});

describe("it survives nonsense input", () => {
  it("handles an empty eligibility set without dividing by zero", () => {
    const r = computeEntitlementScore({ ...base, profileCompleteness: 0 });
    expect(r.score).toBe(0);
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.gaps).toEqual([]);
  });

  it("clamps a nonsensical profile completeness", () => {
    expect(computeEntitlementScore({ ...base, profileCompleteness: 42 }).score).toBe(100);
    expect(computeEntitlementScore({ ...base, profileCompleteness: -5 }).score).toBe(0);
    expect(computeEntitlementScore({ ...base, profileCompleteness: NaN }).score).toBe(0);
  });

  it("ignores negative values rather than subtracting them from the total", () => {
    const r = computeEntitlementScore({
      ...base,
      eligible: [{ id: "bad", yearlyMinor: -500 }, { id: "good", yearlyMinor: 1000 }],
      recoveredMinor: -9,
    });
    expect(r.unclaimedMinor).toBe(1000);
    expect(r.recoveredMinor).toBe(0);
  });

  it("stays within 0..1000 for any input", () => {
    const r = computeEntitlementScore({
      eligible: rights,
      actedOn: ["big", "medium", "small", "varies", "ghost"],
      recovered: [],
      recoveredMinor: Number.MAX_SAFE_INTEGER,
      profileCompleteness: 99,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1000);
  });

  it("ignores acted-on ids that are not in the eligible set", () => {
    const r = computeEntitlementScore({ ...base, eligible: rights, actedOn: ["ghost"] });
    expect(r.actedOnCount).toBe(0);
    expect(r.capturedMinor).toBe(0);
  });
});
