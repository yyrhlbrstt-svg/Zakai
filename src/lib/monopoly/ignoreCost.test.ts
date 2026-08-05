import { describe, expect, it } from "vitest";
import { computeIgnoreCost } from "./ignoreCost";

describe("computeIgnoreCost", () => {
  it("uses integer agorot for desk cost", () => {
    const r = computeIgnoreCost({ dispatchedCases: 60, savedCases: 10 });
    expect(Number.isInteger(r.deskCostAgorot)).toBe(true);
    expect(r.unhandledEstimate).toBe(50);
    expect(r.reputationSignal).toBe("emerging");
  });

  it("marks material reputation at high volume", () => {
    const r = computeIgnoreCost({ dispatchedCases: 200, savedCases: 5 });
    expect(r.reputationSignal).toBe("material");
  });

  it("handles zero backlog", () => {
    const r = computeIgnoreCost({ dispatchedCases: 3, savedCases: 3 });
    expect(r.unhandledEstimate).toBe(0);
    expect(r.deskCostAgorot).toBe(0);
    expect(r.narrative).toMatch(/No estimated unhandled/i);
  });
});
