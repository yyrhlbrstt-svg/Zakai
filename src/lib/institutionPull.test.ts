import { describe, expect, it } from "vitest";
import {
  institutionPilotMailto,
  institutionPullFooterLine,
  roiMailto,
} from "./institutionPull";

describe("institutionPull", () => {
  it("builds mailto that targets sales and invites a pilot", () => {
    const m = institutionPilotMailto({ institutionId: "bank-leumi" });
    expect(m.startsWith("mailto:")).toBe(true);
    expect(m).toContain("bank-leumi");
    expect(m).toContain("Mandate");
  });

  it("keeps footer lines short and honest", () => {
    const he = institutionPullFooterLine("he", "https://zakai.example");
    expect(he).toContain("/he/institutions");
    expect(he.length).toBeLessThan(220);
  });

  it("packs ROI numbers into mailto body", () => {
    const m = roiMailto({
      volume: 200,
      minutes: 12,
      hourlyCost: 120,
      hoursPerMonth: 40,
      costPerYear: 57600,
    });
    expect(decodeURIComponent(m)).toContain("200");
    expect(decodeURIComponent(m)).toContain("57600");
  });
});
