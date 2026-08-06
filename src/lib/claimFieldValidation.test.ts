import { describe, expect, it } from "vitest";
import { isPlausibleTaxYear, isValidIsraeliId } from "./claimFieldValidation";

/** Computes the correct check digit for an 8-digit prefix, mirroring the
 * production checksum so tests aren't hostage to one hardcoded "real" ID. */
function withCheckDigit(prefix8: string): string {
  const padded = prefix8.padStart(8, "0");
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    let digit = Number(padded[i]) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  const check = (10 - (sum % 10)) % 10;
  return padded + check;
}

describe("isValidIsraeliId", () => {
  it("accepts a correctly-checksummed 9-digit id", () => {
    const id = withCheckDigit("12345678");
    expect(isValidIsraeliId(id)).toBe(true);
  });

  it("rejects the reported bug — obviously wrong-length garbage", () => {
    expect(isValidIsraeliId("3636828282")).toBe(false); // 10 digits, from the screenshot
  });

  it("rejects a bad checksum", () => {
    const id = withCheckDigit("12345678");
    const lastDigit = Number(id[8]);
    const wrong = id.slice(0, 8) + String((lastDigit + 1) % 10);
    expect(isValidIsraeliId(wrong)).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(isValidIsraeliId("abcdefghi")).toBe(false);
    expect(isValidIsraeliId("")).toBe(false);
  });
});

describe("isPlausibleTaxYear", () => {
  const NOW = new Date("2026-08-06T00:00:00Z");

  it("accepts a recent year", () => {
    expect(isPlausibleTaxYear("2024", NOW)).toBe(true);
    expect(isPlausibleTaxYear("2026", NOW)).toBe(true);
  });

  it("accepts one year ahead (filing for the current year in progress)", () => {
    expect(isPlausibleTaxYear("2027", NOW)).toBe(true);
  });

  it("rejects the reported bug — a nonsense year", () => {
    expect(isPlausibleTaxYear("6289", NOW)).toBe(false);
  });

  it("rejects years too far in the past for an open tax year", () => {
    expect(isPlausibleTaxYear("2000", NOW)).toBe(false);
  });

  it("rejects non-4-digit input", () => {
    expect(isPlausibleTaxYear("26", NOW)).toBe(false);
    expect(isPlausibleTaxYear("", NOW)).toBe(false);
    expect(isPlausibleTaxYear("abcd", NOW)).toBe(false);
  });
});
