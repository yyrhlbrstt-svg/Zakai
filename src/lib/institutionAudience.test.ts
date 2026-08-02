import { describe, expect, it } from "vitest";
import { resolveMandateAudience, isTrackedInstitutionAudience } from "./institutionAudience";

describe("institutionAudience", () => {
  it("maps bank provider keys to institution slugs", () => {
    expect(resolveMandateAudience("leumi")).toBe("bank-leumi");
    expect(resolveMandateAudience("cellcom")).toBe("cellcom");
  });

  it("tracks institution audiences", () => {
    expect(isTrackedInstitutionAudience("bank-leumi")).toBe(true);
    expect(isTrackedInstitutionAudience("cellcom")).toBe(false);
  });
});
