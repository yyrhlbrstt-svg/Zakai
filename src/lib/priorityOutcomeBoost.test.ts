import { describe, expect, it } from "vitest";
import { catalogBoostsFromOutcomes } from "./priorityOutcomeBoost";
import { rankPriorityActions } from "./priority";

describe("catalogBoostsFromOutcomes", () => {
  it("returns empty boosts when sample is too small", () => {
    const boosts = catalogBoostsFromOutcomes([
      { vertical: "telecom", paid: true, recoveredMinor: 50_000 },
    ]);
    expect(boosts).toEqual({});
  });

  it("boosts catalog id mapped from vertical when evidence is strong", () => {
    const rows = Array.from({ length: 10 }, () => ({
      vertical: "telecom",
      paid: true,
      recoveredMinor: 80_000,
    }));
    const boosts = catalogBoostsFromOutcomes(rows);
    expect(boosts.check).toBeGreaterThan(0);
    expect(boosts.check).toBeLessThanOrEqual(0.28);
  });

  it("applies catalog boosts to ranking weight", () => {
    // money is already #1 unboosted — pick a mid-pack monthly agent door.
    const without = rankPriorityActions(50).findIndex((a) => a.id === "bank-fees");
    const withBoost = rankPriorityActions(50, { "bank-fees": 0.5 }).findIndex(
      (a) => a.id === "bank-fees",
    );
    expect(withBoost).toBeLessThan(without);
  });
});
