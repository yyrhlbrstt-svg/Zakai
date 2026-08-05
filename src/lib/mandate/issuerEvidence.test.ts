import { describe, expect, it } from "vitest";
import {
  dryRunIssuerAdmission,
  issuerEvidenceChecklist,
  issuerEvidencePackage,
} from "./issuerEvidence";
import { ISSUERS } from "./trustRegistry";

describe("issuerEvidence", () => {
  it("exposes a non-empty conformance checklist", async () => {
    const items = issuerEvidenceChecklist();
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.every((i) => i.id && i.probe)).toBe(true);
    expect((await issuerEvidencePackage()).endpoints.dry_run).toContain("/evidence");
  });

  it("dry-runs a well-formed candidate as ok", async () => {
    const result = await dryRunIssuerAdmission({
      iss: "https://second-issuer.example",
      name: "Second Issuer",
      jwksUri: "https://second-issuer.example/.well-known/jwks.json",
      statusListUri: "https://second-issuer.example/api/mandate/revocations",
      allowedScopes: ["read:bills", "dispute:charge"],
      status: "active",
      admittedAt: "2026-08-03",
    });
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.would_join_registry).toBe(true);
  });

  it("rejects forbidden scopes and duplicate iss without mutating registry", async () => {
    const before = ISSUERS.length;
    const forbidden = await dryRunIssuerAdmission({
      iss: "https://bad.example",
      name: "Bad",
      jwksUri: "https://bad.example/jwks",
      statusListUri: "https://bad.example/status",
      allowedScopes: ["payment:transfer"],
      status: "active",
      admittedAt: "2026-08-03",
    });
    expect(forbidden.ok).toBe(false);
    expect(forbidden.problems.some((p) => p.kind === "forbidden_scope")).toBe(true);

    const dup = await dryRunIssuerAdmission({
      ...ISSUERS[0],
      name: "Clone",
    });
    expect(dup.problems.some((p) => p.kind === "duplicate_iss")).toBe(true);
    expect(ISSUERS.length).toBe(before);
  });
});
