import { describe, it, expect } from "vitest";
import { computeDuplication, policyKind } from "./insurance";

describe("computeDuplication", () => {
  it("flags an indemnity overlap as wasteful with a positive estimate", () => {
    const r = computeDuplication({ privateKeys: ["surgery"], collectiveKeys: ["surgery"] });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].wasteful).toBe(true);
    expect(r.wastefulMonthlyAgorot).toBeGreaterThan(0);
    expect(r.wastefulYearlyAgorot).toBe(r.wastefulMonthlyAgorot * 12);
  });

  it("does NOT flag a compensation overlap as waste (stacking is legitimate)", () => {
    const r = computeDuplication({ privateKeys: ["life"], collectiveKeys: ["life"] });
    expect(r.wastefulMonthlyAgorot).toBe(0);
    expect(r.stackableCount).toBe(1);
    expect(r.findings[0].wasteful).toBe(false);
  });

  it("ignores a policy held on only one side (no overlap)", () => {
    const r = computeDuplication({ privateKeys: ["surgery"], collectiveKeys: ["drugs"] });
    expect(r.findings).toHaveLength(0);
    expect(r.wastefulMonthlyAgorot).toBe(0);
  });

  it("sums multiple wasteful indemnity overlaps", () => {
    const r = computeDuplication({
      privateKeys: ["surgery", "drugs"],
      collectiveKeys: ["surgery", "drugs"],
    });
    expect(r.findings.filter((f) => f.wasteful)).toHaveLength(2);
    expect(r.wastefulMonthlyAgorot).toBe(6000 + 4500);
  });

  it("separates wasteful and stackable in a mixed portfolio", () => {
    const r = computeDuplication({
      privateKeys: ["surgery", "life"],
      collectiveKeys: ["surgery", "life"],
    });
    expect(r.wastefulMonthlyAgorot).toBe(6000); // only surgery counts
    expect(r.stackableCount).toBe(1); // life stacks
  });

  it("classifies kinds correctly", () => {
    expect(policyKind("surgery")).toBe("indemnity");
    expect(policyKind("life")).toBe("compensation");
    expect(policyKind("nonexistent")).toBeNull();
  });
});
