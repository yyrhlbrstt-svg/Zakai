import { describe, expect, it } from "vitest";
import {
  buildVerifierWelcomeEmail,
  conformanceProbeEmailSection,
} from "./institutionVerifierOnboardingEmail";

describe("institutionVerifierOnboardingEmail", () => {
  it("includes pilot close path and conformance probe", () => {
    const section = conformanceProbeEmailSection("https://example.test", "bank-demo");
    expect(section).toContain("/api/mandate/conformance/probe");
    expect(section).toContain("/api/institution/pilot-package?audience=bank-demo");
    expect(section).toContain("/api/network/join-kit");
  });

  it("welcome email names institution and points at pilot package", () => {
    const { body, subject } = buildVerifierWelcomeEmail({
      origin: "https://example.test",
      institutionId: "bank-demo",
      displayNameEn: "Demo Bank",
      tier: "pioneer",
      publicLeadersUrl: "https://example.test/he/institutions/leaders",
    });
    expect(subject).toContain("pioneer");
    expect(body).toContain("bank-demo");
    expect(body).toContain("pilot-package");
    expect(body).toContain("outreach-kit");
  });
});
