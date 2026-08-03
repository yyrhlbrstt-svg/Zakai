import { describe, expect, it } from "vitest";
import {
  buildVerifierWelcomeEmail,
  conformanceProbeEmailSection,
} from "./institutionVerifierOnboardingEmail";

describe("institutionVerifierOnboardingEmail", () => {
  it("includes conformance probe endpoint", () => {
    const section = conformanceProbeEmailSection("https://example.test");
    expect(section).toContain("/api/mandate/conformance/probe");
  });

  it("welcome email names institution", () => {
    const { body, subject } = buildVerifierWelcomeEmail({
      origin: "https://example.test",
      institutionId: "bank-demo",
      displayNameEn: "Demo Bank",
      tier: "pioneer",
      publicLeadersUrl: "https://example.test/he/institutions/leaders",
    });
    expect(subject).toContain("pioneer");
    expect(body).toContain("bank-demo");
    expect(body).toContain("conformance/probe");
  });
});
