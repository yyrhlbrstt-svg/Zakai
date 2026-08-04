import { describe, expect, it } from "vitest";
import { resolveMandateAudience, isTrackedInstitutionAudience } from "./institutionAudience";

describe("institutionAudience", () => {
  it("maps bank provider keys to institution slugs", () => {
    expect(resolveMandateAudience("leumi")).toBe("bank-leumi");
    expect(resolveMandateAudience("cellcom")).toBe("cellcom");
  });

  it("tracks institution audiences", () => {
    expect(isTrackedInstitutionAudience("bank-leumi")).toBe(true);
    // cellcom is a registered institution in INSTITUTION_PROVIDER_MAP (phase 2:
    // telecom/electricity) — it must be tracked so notifyInstitutionOnOutboundSend
    // actually fires for it, not just for banks.
    expect(isTrackedInstitutionAudience("cellcom")).toBe(true);
    expect(isTrackedInstitutionAudience("some-unregistered-provider")).toBe(false);
  });
});
