import { describe, expect, it } from "vitest";
import { LIFE_SITUATIONS, STARTER_PACK } from "./mustHaveKit";

describe("mustHaveKit", () => {
  it("starter pack has eight action doors with hrefs", () => {
    expect(STARTER_PACK).toHaveLength(8);
    for (const t of STARTER_PACK) {
      expect(t.href.startsWith("/")).toBe(true);
      expect(t.costHe.length).toBeGreaterThan(8);
      expect(t.costEn.length).toBeGreaterThan(8);
    }
  });

  it("covers life situations with tools", () => {
    expect(LIFE_SITUATIONS.length).toBeGreaterThanOrEqual(6);
    for (const s of LIFE_SITUATIONS) {
      expect(s.tools.length).toBeGreaterThanOrEqual(3);
    }
  });
});
