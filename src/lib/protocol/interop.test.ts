import { describe, expect, it } from "vitest";
import {
  aggregateProfileStatus,
  buildInteropDocument,
  INTEROP_PROBE_CHECKS,
  INTEROP_PROFILES,
} from "./interop";

describe("zakai interop standard", () => {
  it("defines profiles with probe coverage", () => {
    for (const p of INTEROP_PROFILES) {
      const probes = INTEROP_PROBE_CHECKS.filter((c) => c.profile === p.id);
      expect(probes.length, `${p.id} has no probes`).toBeGreaterThan(0);
    }
  });

  it("builds a stable discovery document", () => {
    const doc = buildInteropDocument("https://zakai.example");
    expect(doc.spec).toBe("zakai-interop");
    expect(doc.well_known.protocol).toContain("zakai-protocol.json");
    expect(doc.mandate_conformance.checks_count).toBeGreaterThan(5);
  });

  it("aggregates profile pass/fail", () => {
    const profiles = aggregateProfileStatus([
      { id: "protocol_well_known", profile: "zakai-core-1", ok: true },
      { id: "version", profile: "zakai-core-1", ok: false },
    ]);
    const core = profiles.find((p) => p.id === "zakai-core-1");
    expect(core?.status).toBe("fail");
    expect(core?.failed_checks).toContain("version");
  });
});
