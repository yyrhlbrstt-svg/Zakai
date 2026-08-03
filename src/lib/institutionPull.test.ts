import { describe, expect, it } from "vitest";
import {
  institutionPilotMailto,
  institutionPipeMagnetLine,
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

  it("keeps footer lines short and points at Quickstart + decide", () => {
    const he = institutionPullFooterLine("he", "https://zakai.example");
    expect(he).toContain("/he/institutions/quickstart");
    expect(he).toContain("/api/mandate/decide");
    expect(he.length).toBeLessThan(280);
  });

  it("publishes machine pipe accept magnet", () => {
    const line = institutionPipeMagnetLine("https://zakai.example/");
    expect(line).toContain("/api/pipe/accept");
    expect(line).toContain("zakai-jwks.json");
    expect(line.length).toBeLessThan(280);
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
