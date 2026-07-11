import { describe, it, expect } from "vitest";
import {
  generateNumericCode,
  hashCode,
  generateAuthorizationCode,
  safeEqualHex,
} from "./codes";

describe("generateNumericCode", () => {
  it("produces a 6-digit numeric code by default", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateNumericCode()).toMatch(/^\d{6}$/);
    }
  });

  it("respects a custom length", () => {
    expect(generateNumericCode(4)).toMatch(/^\d{4}$/);
  });

  it("is not trivially constant", () => {
    const set = new Set(Array.from({ length: 30 }, () => generateNumericCode()));
    expect(set.size).toBeGreaterThan(1);
  });
});

describe("hashCode", () => {
  it("is deterministic and hides the code", () => {
    const code = "123456";
    expect(hashCode(code)).toBe(hashCode(code));
    expect(hashCode(code)).not.toContain(code);
    expect(hashCode(code)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs for different codes", () => {
    expect(hashCode("123456")).not.toBe(hashCode("123457"));
  });
});

describe("safeEqualHex", () => {
  it("matches equal hashes and rejects unequal ones", () => {
    expect(safeEqualHex(hashCode("111111"), hashCode("111111"))).toBe(true);
    expect(safeEqualHex(hashCode("111111"), hashCode("222222"))).toBe(false);
    expect(safeEqualHex("abc", "abcd")).toBe(false);
  });
});

describe("generateAuthorizationCode", () => {
  it("has the ZK-XXXX-XXXX shape with an unambiguous alphabet", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateAuthorizationCode();
      expect(code).toMatch(/^ZK-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      // no ambiguous characters
      expect(code).not.toMatch(/[O0I1]/);
    }
  });

  it("is effectively unique across many draws", () => {
    const set = new Set(Array.from({ length: 500 }, () => generateAuthorizationCode()));
    expect(set.size).toBe(500);
  });
});
