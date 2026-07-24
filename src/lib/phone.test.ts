import { describe, it, expect } from "vitest";
import {
  normalizeIsraeliMobile,
  isValidIsraeliMobile,
  normalizePhone,
  isValidPhone,
  maskPhone,
} from "./phone";

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

describe("normalizePhone (international)", () => {
  it("keeps Israeli local convenience", () => {
    expect(normalizePhone("0501234567")).toBe("+972501234567");
    expect(normalizePhone("050-123-4567")).toBe("+972501234567");
  });

  it("accepts international numbers from any country", () => {
    expect(normalizePhone("+14155550123")).toBe("+14155550123"); // US
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123"); // UK
    expect(normalizePhone("0044 7700 900123")).toBe("+447700900123"); // 00 prefix
    expect(normalizePhone("447700900123")).toBe("+447700900123"); // bare intl digits
    expect(normalizePhone("+33 6 12 34 56 78")).toBe("+33612345678"); // FR
  });

  it("rejects implausible numbers", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("+123")).toBeNull(); // too short
    expect(normalizePhone("+0123456789")).toBeNull(); // country code can't start with 0
    expect(normalizePhone("021234567")).toBeNull(); // Israeli landline, not mobile
  });

  it("isValidPhone agrees", () => {
    expect(isValidPhone("+14155550123")).toBe(true);
    expect(isValidPhone("0501234567")).toBe(true);
    expect(isValidPhone("nope")).toBe(false);
  });
});

describe("maskPhone", () => {
  it("masks the middle digits, keeping the lead and last four", () => {
    expect(maskPhone("+972501234567")).toBe("+972*****-4567");
    expect(maskPhone("0501234567")).toBe("+972*****-4567");
    expect(maskPhone("+14155550123")).toBe("+141****-0123");
  });

  it("returns a safe placeholder for junk", () => {
    expect(maskPhone("nonsense")).toBe("***");
  });
});
