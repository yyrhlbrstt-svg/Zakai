import { describe, it, expect } from "vitest";
import { normalizeIsraeliMobile, isValidIsraeliMobile, maskPhone } from "./phone";

describe("normalizeIsraeliMobile", () => {
  it("normalizes local, dashed, and international forms to E.164", () => {
    expect(normalizeIsraeliMobile("0501234567")).toBe("+972501234567");
    expect(normalizeIsraeliMobile("050-123-4567")).toBe("+972501234567");
    expect(normalizeIsraeliMobile("+972501234567")).toBe("+972501234567");
    expect(normalizeIsraeliMobile("972501234567")).toBe("+972501234567");
    expect(normalizeIsraeliMobile("00972501234567")).toBe("+972501234567");
    expect(normalizeIsraeliMobile(" 054 999 8888 ")).toBe("+972549998888");
  });

  it("rejects non-mobile and malformed numbers", () => {
    expect(normalizeIsraeliMobile("021234567")).toBeNull(); // landline
    expect(normalizeIsraeliMobile("05012345")).toBeNull(); // too short
    expect(normalizeIsraeliMobile("05012345678")).toBeNull(); // too long
    expect(normalizeIsraeliMobile("+15551234567")).toBeNull(); // not Israeli
    expect(normalizeIsraeliMobile("")).toBeNull();
    expect(normalizeIsraeliMobile("abc")).toBeNull();
  });

  it("isValidIsraeliMobile agrees", () => {
    expect(isValidIsraeliMobile("0501234567")).toBe(true);
    expect(isValidIsraeliMobile("nope")).toBe(false);
  });
});

describe("maskPhone", () => {
  it("hides the middle digits", () => {
    expect(maskPhone("+972501234567")).toBe("+972-50-***-4567");
    expect(maskPhone("0501234567")).toBe("+972-50-***-4567");
  });
});
