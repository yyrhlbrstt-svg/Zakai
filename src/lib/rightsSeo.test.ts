import { describe, it, expect } from "vitest";
import {
  entitlementSlug,
  entitlementIdFromSlug,
  IL_RIGHT_SLUGS,
} from "./rightsSeo";

describe("rightsSeo", () => {
  it("round-trips IL slugs", () => {
    const slug = entitlementSlug("tax_refund");
    expect(slug).toBe("tax-refund");
    expect(entitlementIdFromSlug(slug)).toBe("tax_refund");
  });

  it("lists all IL rights for static generation", () => {
    expect(IL_RIGHT_SLUGS.length).toBeGreaterThanOrEqual(70);
    expect(IL_RIGHT_SLUGS).toContain("mobile-check");
  });
});
