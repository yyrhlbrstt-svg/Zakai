import { describe, expect, it } from "vitest";
import { normalizeIdempotencyKey } from "./idempotency";

describe("normalizeIdempotencyKey", () => {
  it("trims and accepts valid keys", () => {
    expect(normalizeIdempotencyKey("  abc-123  ")).toBe("abc-123");
  });

  it("rejects empty and overlong", () => {
    expect(normalizeIdempotencyKey("")).toBeNull();
    expect(normalizeIdempotencyKey("x".repeat(200))).toBeNull();
  });
});
