import { describe, expect, it } from "vitest";
import { buildFairnessCertifiedDocument } from "./fairnessCertified";

describe("buildFairnessCertifiedDocument", () => {
  it("stays spec_only with empty certified list", () => {
    const doc = buildFairnessCertifiedDocument("https://zakai.example");
    expect(doc.status).toBe("spec_only");
    expect(doc.certified_providers).toEqual([]);
    expect(doc.honesty).toMatch(/empty/i);
    expect(doc.endpoints.scores).toContain("/api/fairness/scores");
  });
});
