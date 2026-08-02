import { describe, expect, it } from "vitest";
import { firstOutreachEmail, normalizeOutreachEmail } from "./outreachEmail";

describe("outreachEmail", () => {
  it("normalizes valid email", () => {
    expect(normalizeOutreachEmail("  Billing@Shop.COM ")).toBe("billing@shop.com");
  });

  it("rejects invalid", () => {
    expect(normalizeOutreachEmail("nope")).toBeNull();
  });

  it("first wins", () => {
    expect(firstOutreachEmail(undefined, "a@b.co", "c@d.co")).toBe("a@b.co");
  });
});
