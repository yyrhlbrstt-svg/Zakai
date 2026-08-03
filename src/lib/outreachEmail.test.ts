import { describe, expect, it } from "vitest";
import {
  firstOutreachEmail,
  isPlaceholderOutreachHost,
  normalizeOutreachEmail,
  usableOutreachEmail,
} from "./outreachEmail";

describe("outreachEmail", () => {
  it("normalizes addresses", () => {
    expect(normalizeOutreachEmail("  Billing@Shop.COM ")).toBe("billing@shop.com");
    expect(normalizeOutreachEmail("nope")).toBeNull();
  });

  it("picks the first usable candidate", () => {
    expect(firstOutreachEmail(undefined, "a@b.co", "c@d.co")).toBe("a@b.co");
  });

  it("rejects IETF example hosts", () => {
    expect(isPlaceholderOutreachHost("a@airline.example")).toBe(true);
    expect(usableOutreachEmail("customerservice@airline.example")).toBeNull();
    expect(firstOutreachEmail("x@example.com", "real@elal.co.il")).toBe("real@elal.co.il");
  });

  it("normalizes usable addresses", () => {
    expect(usableOutreachEmail("  Support@Bank.Co.Il ")).toBe("support@bank.co.il");
  });
});
