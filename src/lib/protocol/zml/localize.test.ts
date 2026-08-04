import { describe, it, expect } from "vitest";
import type { ZmlRight } from "./types";
import { resolveZmlDisplayName } from "./localize";

const sample: ZmlRight = {
  zml_version: "1.0.0",
  id: "il_arnona_area_correction",
  display_name: {
    en: "Fix an incorrect property size on arnona",
    he: "תיקון שטח נכס שגוי בארנונה",
  },
  market: "IL",
  category: "housing",
  predicate: { operator: "AND", conditions: [] },
  action: { kind: "letter", requires_human_gate: true },
  source: { type: "statute", reference: "test" },
};

describe("resolveZmlDisplayName", () => {
  it("returns Hebrew for he locale", () => {
    expect(resolveZmlDisplayName(sample, "he")).toBe("תיקון שטח נכס שגוי בארנונה");
  });

  it("falls back to English", () => {
    expect(resolveZmlDisplayName(sample, "en")).toBe(
      "Fix an incorrect property size on arnona",
    );
  });
});
