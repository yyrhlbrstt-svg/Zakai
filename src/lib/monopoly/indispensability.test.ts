import { describe, expect, it } from "vitest";
import { buildIndispensabilityDocument } from "./indispensability";
import { CONTROL_PHASE } from "./trillionGates";

describe("buildIndispensabilityDocument", () => {
  it("composes links and refuses valuation language", () => {
    const doc = buildIndispensabilityDocument({
      origin: "https://zakai.example/",
      gravityIndex: 12,
      infrastructureScore: 34,
      control: {
        phase: CONTROL_PHASE.SKELETON,
        gatesPassed: 0,
        gatesTotal: 9,
        nextBlocker: "G1_interop_green: probe",
        disclaimer: "Gates are not a valuation.",
      },
    });
    expect(doc.spec).toBe("zakai-indispensability");
    expect(doc.links.trillion_gates).toContain("/api/network/trillion-gates");
    expect(doc.links.pipe).toContain("/api/pipe");
    expect(doc.disclaimer).toMatch(/not market share/i);
    expect(doc.phase).toBe(CONTROL_PHASE.SKELETON);
  });
});
