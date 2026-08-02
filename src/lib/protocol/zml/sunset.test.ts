import { describe, it, expect } from "vitest";
import { dedupeZmlRights, isZmlSunset } from "@/lib/protocol/zml/sunset";
import type { ZmlRight } from "@/lib/protocol/zml/types";

const base = (over: Partial<ZmlRight>): ZmlRight => ({
  zml_version: "1.0.0",
  id: "il_test",
  display_name: { en: "Test" },
  market: "IL",
  category: "tax",
  predicate: { operator: "AND", conditions: [] },
  action: { kind: "letter", requires_human_gate: true },
  source: { type: "statute", reference: "test" },
  ...over,
});

describe("ZML sunset", () => {
  it("hides sunset rights from dedupe output", () => {
    const rights = [
      base({
        id: "il_old",
        metadata: { sunset_date: "2020-01-01", last_verified: "2019-01-01" },
      }),
      base({ id: "il_active", metadata: { last_verified: "2026-01-01" } }),
    ];
    const out = dedupeZmlRights(rights);
    expect(out.map((r) => r.id)).toEqual(["il_active"]);
    expect(isZmlSunset(rights[0]!)).toBe(true);
  });
});
