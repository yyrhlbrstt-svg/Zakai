import { describe, expect, it } from "vitest";
import { resolveTelecomContactEmail, telecomNeedsContactEmail } from "./telecomContacts";

describe("telecomContacts", () => {
  it("resolves Cellcom", () => {
    expect(resolveTelecomContactEmail("cellcom")).toBe("service@cellcom.co.il");
  });

  it("returns null for other", () => {
    expect(resolveTelecomContactEmail("other")).toBeNull();
  });

  it("override satisfies need", () => {
    expect(telecomNeedsContactEmail("other", "help@brand.co.il")).toBe(false);
  });
});
