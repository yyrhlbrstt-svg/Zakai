import { describe, expect, it } from "vitest";
import { readinessOperationalScore, readinessTier } from "./readinessScore";

describe("readinessOperationalScore", () => {
  it("counts only boolean layers", () => {
    expect(readinessOperationalScore({ a: true, b: false })).toBe(50);
    expect(readinessOperationalScore({ a: true, b: true, c: true })).toBe(100);
  });

  it("tiers map honestly", () => {
    expect(readinessTier(40)).toBe("blocked");
    expect(readinessTier(70)).toBe("degraded");
    expect(readinessTier(90)).toBe("operational");
  });
});
