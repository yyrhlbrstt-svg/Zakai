import { describe, expect, it } from "vitest";
import { buildDomainsDocument } from "./domains";
import { buildSwitchingDocument } from "./switching";

describe("five domains manifest", () => {
  it("lists five domains with endpoints", () => {
    const doc = buildDomainsDocument("https://zakai.example");
    expect(doc.domains).toHaveLength(5);
    expect(doc.domains.map((d) => d.id)).toEqual([
      "zml",
      "fairness_score",
      "switching_protocol",
      "regulatory_intelligence",
      "collective_intent",
    ]);
  });

  it("switching spec has reference profiles", () => {
    const sw = buildSwitchingDocument("https://zakai.example");
    expect(sw.profiles.some((p) => p.id === "telecom-disconnect-il-1")).toBe(true);
  });
});
