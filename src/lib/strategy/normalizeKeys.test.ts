import { describe, expect, it } from "vitest";
import {
  normalizeOutcomeVariantId,
  normalizeOutcomeVertical,
} from "./normalizeKeys";

describe("normalizeOutcomeVertical", () => {
  it("maps underscore aliases to Case keys", () => {
    expect(normalizeOutcomeVertical("transport_fine")).toBe("transport-fine");
    expect(normalizeOutcomeVertical("late_payment")).toBe("late-payment");
  });
});

describe("normalizeOutcomeVariantId", () => {
  it("accepts catalog stances", () => {
    expect(normalizeOutcomeVariantId("firm_statutory")).toBe("firm_statutory");
  });

  it("maps standard → firm_statutory", () => {
    expect(normalizeOutcomeVariantId("standard")).toBe("firm_statutory");
  });

  it("rejects free-form ids", () => {
    expect(normalizeOutcomeVariantId("some_right_id")).toBeNull();
  });
});
