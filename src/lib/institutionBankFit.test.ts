import { describe, expect, it } from "vitest";
import { INSTITUTION_FIT_HYPOTHESES } from "./institutionBankFit";

describe("institutionBankFit", () => {
  it("lists distinct institution hypotheses", () => {
    const ids = INSTITUTION_FIT_HYPOTHESES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never claims tier high without a concrete why", () => {
    for (const row of INSTITUTION_FIT_HYPOTHESES) {
      expect(row.whyHe.length).toBeGreaterThan(20);
      expect(row.whyEn.length).toBeGreaterThan(20);
    }
  });
});
