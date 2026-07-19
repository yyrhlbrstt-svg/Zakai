import { describe, it, expect } from "vitest";
import { computeMoneyScore, type MoneyScoreInput } from "./moneyScore";

const fresh: MoneyScoreInput = {
  casesCount: 0,
  hasDocumentedSaving: false,
  daysSinceActivity: null,
  plan: "FREE",
  hasReferred: false,
};

describe("computeMoneyScore", () => {
  it("is 0 for a brand-new user, with first check as the top mission", () => {
    const r = computeMoneyScore(fresh);
    expect(r.score).toBe(0);
    expect(r.level).toBe("start");
    expect(r.missions[0].key).toBe("saving"); // highest points first
    expect(r.missions.some((m) => m.key === "firstCheck")).toBe(true);
  });

  it("awards points for the first check and recent activity", () => {
    const r = computeMoneyScore({ ...fresh, casesCount: 1, daysSinceActivity: 5 });
    expect(r.score).toBe(25 + 10); // firstCheck + fresh
    expect(r.components.find((c) => c.key === "firstCheck")!.earned).toBe(true);
  });

  it("reaches a perfect score when everything is covered", () => {
    const r = computeMoneyScore({
      casesCount: 3,
      hasDocumentedSaving: true,
      daysSinceActivity: 1,
      plan: "MAX",
      hasReferred: true,
    });
    expect(r.score).toBe(100);
    expect(r.level).toBe("excellent");
    expect(r.missions.length).toBe(0);
  });

  it("does not count stale activity as fresh", () => {
    const stale = computeMoneyScore({ ...fresh, casesCount: 1, daysSinceActivity: 200 });
    expect(stale.components.find((c) => c.key === "fresh")!.earned).toBe(false);
    expect(stale.missions.some((m) => m.key === "fresh")).toBe(true);
  });

  it("sorts missions by value, highest first", () => {
    const r = computeMoneyScore({ ...fresh, casesCount: 1, daysSinceActivity: 5 });
    const pts = r.missions.map((m) => m.points);
    expect(pts).toEqual([...pts].sort((a, b) => b - a));
  });

  it("maps score ranges to levels", () => {
    expect(computeMoneyScore({ ...fresh, casesCount: 1 }).level).toBe("start"); // 25
    expect(
      computeMoneyScore({ ...fresh, casesCount: 3, daysSinceActivity: 1 }).level,
    ).toBe("onTrack"); // 25+15+10=50
    expect(
      computeMoneyScore({ ...fresh, casesCount: 3, hasDocumentedSaving: true, daysSinceActivity: 1 })
        .level,
    ).toBe("good"); // 80
  });
});
