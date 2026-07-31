import { describe, expect, it } from "vitest";
import { secretsMatch } from "./timingSafe";

describe("secretsMatch", () => {
  it("matches identical secrets", () => {
    expect(secretsMatch("Bearer abc123", "Bearer abc123")).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(secretsMatch("Bearer abc124", "Bearer abc123")).toBe(false);
  });

  it("rejects a prefix of the real secret", () => {
    // The exact case a length-revealing or short-circuiting comparison gets
    // wrong: this must fail closed, not fail informatively.
    expect(secretsMatch("Bearer abc", "Bearer abc123")).toBe(false);
  });

  it("rejects an empty guess against a real secret", () => {
    expect(secretsMatch("", "Bearer abc123")).toBe(false);
  });

  it("treats two empty strings as equal", () => {
    expect(secretsMatch("", "")).toBe(true);
  });

  it("does not throw on differing lengths", () => {
    // The whole reason to hash first: timingSafeEqual throws on unequal
    // buffer lengths, and a caller who forgets that check re-introduces a
    // length-based timing leak while fixing the byte-based one.
    expect(() => secretsMatch("short", "a much longer secret value")).not.toThrow();
  });
});
