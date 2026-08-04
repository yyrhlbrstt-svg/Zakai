import { describe, expect, it } from "vitest";
import { resolveMandateAudience, isTrackedInstitutionAudience } from "./institutionAudience";

describe("institutionAudience", () => {
  it("maps bank provider keys to institution slugs", () => {
    expect(resolveMandateAudience("leumi")).toBe("bank-leumi");
    expect(resolveMandateAudience("cellcom")).toBe("cellcom");
  });

  it("tracks institution audiences", () => {
    expect(isTrackedInstitutionAudience("bank-leumi")).toBe(true);
    // Telecom desks are in INSTITUTION_PROVIDER_MAP for inbound pressure.
    expect(isTrackedInstitutionAudience("cellcom")).toBe(true);
    expect(isTrackedInstitutionAudience("random-corner-shop")).toBe(false);
  });
});
