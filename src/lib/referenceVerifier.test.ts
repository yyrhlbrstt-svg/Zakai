import { describe, expect, it } from "vitest";
import { institutionDisplayName, isValidInstitutionSlug } from "./referenceVerifier";

describe("isValidInstitutionSlug", () => {
  it("accepts bank-style slugs", () => {
    expect(isValidInstitutionSlug("bank-leumi")).toBe(true);
    expect(isValidInstitutionSlug("pepper")).toBe(true);
  });

  it("rejects invalid slugs", () => {
    expect(isValidInstitutionSlug("")).toBe(false);
    expect(isValidInstitutionSlug(" bank-leumi ")).toBe(true);
    expect(isValidInstitutionSlug("bank--leumi")).toBe(false);
    expect(isValidInstitutionSlug("a")).toBe(false);
  });
});

describe("institutionDisplayName", () => {
  const row = { displayNameHe: "עברית", displayNameEn: "English" };

  it("picks Hebrew for he/ar", () => {
    expect(institutionDisplayName("he", row)).toBe("עברית");
    expect(institutionDisplayName("ar", row)).toBe("עברית");
  });

  it("picks English for other locales", () => {
    expect(institutionDisplayName("en", row)).toBe("English");
  });
});
