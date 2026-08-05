import { describe, expect, it } from "vitest";
import { buildDomainsDocument } from "./domains";
import { buildSwitchingDocument } from "./switching";

describe("domains manifest", () => {
  it("lists pipe + infrastructure domains with endpoints", () => {
    const doc = buildDomainsDocument("https://zakai.example");
    expect(doc.domains.length).toBeGreaterThanOrEqual(7);
    expect(doc.domains.map((d) => d.id)).toContain("pipe");
    expect(doc.domains.map((d) => d.id)).toContain("autopilot");
    expect(doc.domains.find((d) => d.id === "pipe")?.endpoints.accept).toContain(
      "/api/pipe/accept",
    );
  });

  it("switching spec has reference profiles", () => {
    const sw = buildSwitchingDocument("https://zakai.example");
    expect(sw.profiles.some((p) => p.id === "telecom-disconnect-il-1")).toBe(true);
  });
});
