import { describe, expect, it } from "vitest";
import { resolveCaseOutreachTo } from "./caseOutreach";

describe("resolveCaseOutreachTo", () => {
  it("prefers counterparty email", () => {
    expect(
      resolveCaseOutreachTo({
        counterpartyEmail: "billing@merchant.co.il",
        provider: "other",
        vertical: "subscription",
      }),
    ).toBe("billing@merchant.co.il");
  });

  it("falls back to telecom registry", () => {
    expect(
      resolveCaseOutreachTo({
        counterpartyEmail: null,
        provider: "cellcom",
        vertical: "telecom",
      }),
    ).toBe("service@cellcom.co.il");
  });

  it("returns null when unknown", () => {
    expect(
      resolveCaseOutreachTo({
        counterpartyEmail: "",
        provider: "other",
        vertical: "subscription",
      }),
    ).toBeNull();
  });
});
