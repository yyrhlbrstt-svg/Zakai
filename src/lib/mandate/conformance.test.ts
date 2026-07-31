import { describe, expect, it } from "vitest";
import { CHECKS, assessConformance, conformanceDocument, type CheckResult } from "./conformance";
import { FORBIDDEN_SCOPES } from "./scopes";

const allPassing: CheckResult[] = CHECKS.map((c) => ({ id: c.id, passed: true }));

describe("admission is on evidence", () => {
  it("admits an implementation that passes everything", () => {
    const report = assessConformance(allPassing);
    expect(report.verdict).toBe("conformant");
    expect(report.blocking).toEqual([]);
    expect(report.missing).toEqual([]);
  });

  it("refuses admission on any single required failure", () => {
    for (const check of CHECKS.filter((c) => c.severity === "must")) {
      const results = allPassing.map((r) =>
        r.id === check.id ? { ...r, passed: false } : r,
      );
      const report = assessConformance(results);
      expect({ id: check.id, verdict: report.verdict }).toEqual({
        id: check.id,
        verdict: "not_conformant",
      });
    }
  });

  it("publishes recommended failures rather than hiding or blocking on them", () => {
    const optional = CHECKS.find((c) => c.severity === "should")!;
    const report = assessConformance(
      allPassing.map((r) => (r.id === optional.id ? { ...r, passed: false } : r)),
    );
    expect(report.verdict).toBe("conformant_with_notes");
    expect(report.notes.map((c) => c.id)).toContain(optional.id);
    expect(report.summary).toMatch(/published on the registry entry/);
  });
});

describe("silence is not a pass", () => {
  it("counts an unrun required check as a failure", () => {
    // Otherwise an incomplete run looks identical to a clean one, and the first
    // issuer to notice submits exactly the subset it can pass.
    const partial = allPassing.filter((r) => r.id !== "enforces_audience");
    const report = assessConformance(partial);
    expect(report.verdict).toBe("not_conformant");
    expect(report.missing).toContain("enforces_audience");
  });

  it("refuses an empty submission outright", () => {
    const report = assessConformance([]);
    expect(report.verdict).toBe("not_conformant");
    expect(report.missing).toHaveLength(CHECKS.length);
  });

  it("says so in the published rules, before anyone wastes the effort", () => {
    expect(conformanceDocument().rules[0]).toMatch(/not run counts as failed/);
  });
});

describe("the suite tests refusal, not capability", () => {
  it("requires more refusals than productions", () => {
    // Producing something mandate-shaped is easy and proves nothing. An issuer
    // that accepts everything passes a naive suite and is worse than useless in
    // a trust network, because everyone else relies on it to say no.
    const refusals = CHECKS.filter((c) => /rejects|refuses|enforces/.test(c.id));
    expect(refusals.length).toBeGreaterThanOrEqual(4);
    for (const r of refusals) expect(r.severity).toBe("must");
  });

  it("names every forbidden scope in the requirement text", () => {
    const check = CHECKS.find((c) => c.id === "refuses_forbidden_scope")!;
    for (const scope of FORBIDDEN_SCOPES) {
      expect(check.requirement).toContain(scope);
    }
  });

  it("makes revocation-takes-effect a blocking requirement", () => {
    // A revocation that does not land means a person withdrew authority and the
    // network kept acting on it. Everything else is decoration if this fails.
    expect(CHECKS.find((c) => c.id === "revocation_takes_effect")!.severity).toBe("must");
  });

  it("explains to every implementer why each rule protects the others", () => {
    for (const c of CHECKS) {
      expect(c.rationale.length).toBeGreaterThan(60);
      expect(c.requirement.length).toBeGreaterThan(20);
    }
  });
});
