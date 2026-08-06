import { describe, expect, it } from "vitest";
import { planPriority, sortByFollowUpPriority } from "./followUpPriority";

describe("planPriority", () => {
  it("ranks paid tiers above FREE", () => {
    expect(planPriority("FREE")).toBe(0);
    expect(planPriority("PRO")).toBeGreaterThan(planPriority("FREE"));
    expect(planPriority("MAX")).toBeGreaterThan(planPriority("PRO"));
    expect(planPriority("BUSINESS")).toBeGreaterThan(planPriority("MAX"));
  });

  it("treats null/unknown as FREE", () => {
    expect(planPriority(null)).toBe(planPriority("FREE"));
    expect(planPriority("something_unknown")).toBe(planPriority("FREE"));
  });
});

describe("sortByFollowUpPriority", () => {
  it("puts paid tiers before FREE regardless of wait time", () => {
    const now = Date.now();
    const cases = [
      { id: "free-old", plan: "FREE", updatedAt: new Date(now - 10 * 86_400_000) },
      { id: "pro-new", plan: "PRO", updatedAt: new Date(now - 1 * 86_400_000) },
      { id: "max-mid", plan: "MAX", updatedAt: new Date(now - 5 * 86_400_000) },
    ];
    const sorted = sortByFollowUpPriority(cases);
    expect(sorted.map((c) => c.id)).toEqual(["max-mid", "pro-new", "free-old"]);
  });

  it("within the same tier, oldest-waiting goes first", () => {
    const now = Date.now();
    const cases = [
      { id: "pro-new", plan: "PRO", updatedAt: new Date(now - 1 * 86_400_000) },
      { id: "pro-old", plan: "PRO", updatedAt: new Date(now - 9 * 86_400_000) },
    ];
    const sorted = sortByFollowUpPriority(cases);
    expect(sorted.map((c) => c.id)).toEqual(["pro-old", "pro-new"]);
  });

  it("does not mutate the input array", () => {
    const cases = [
      { id: "a", plan: "FREE", updatedAt: new Date(0) },
      { id: "b", plan: "MAX", updatedAt: new Date(0) },
    ];
    const original = [...cases];
    sortByFollowUpPriority(cases);
    expect(cases).toEqual(original);
  });
});
