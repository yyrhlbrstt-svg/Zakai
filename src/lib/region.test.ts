import { describe, it, expect } from "vitest";
import { countryFromPhone, resolveCountry, isHomeMarket } from "./region";

describe("countryFromPhone", () => {
  it("reads Israel from a +972 number", () => {
    expect(countryFromPhone("+972501234567")).toBe("IL");
    expect(countryFromPhone("972-50-123-4567")).toBe("IL");
  });

  it("reads the US from a +1 number and the UK from +44", () => {
    expect(countryFromPhone("+1 415 555 0100")).toBe("US");
    expect(countryFromPhone("+44 7911 123456")).toBe("GB");
  });

  it("prefers the longer prefix (972 over 9/7)", () => {
    expect(countryFromPhone("+9725...")).toBe("IL");
  });

  it("returns empty for a national-format number (leading 0, no country)", () => {
    expect(countryFromPhone("0501234567")).toBe("");
  });

  it("returns empty for missing or unknown", () => {
    expect(countryFromPhone("")).toBe("");
    expect(countryFromPhone(null)).toBe("");
    expect(countryFromPhone("+99900011122")).toBe("");
  });
});

describe("resolveCountry", () => {
  it("phone wins over IP when both are present", () => {
    expect(resolveCountry({ phone: "+14155550100", ipCountry: "IL" })).toBe("US");
  });

  it("falls back to IP country when phone is national/unknown", () => {
    expect(resolveCountry({ phone: "0501234567", ipCountry: "us" })).toBe("US");
  });

  it("returns empty when neither signal is usable", () => {
    expect(resolveCountry({ phone: "", ipCountry: "" })).toBe("");
  });
});

describe("isHomeMarket", () => {
  it("treats Israel and unknown as home", () => {
    expect(isHomeMarket("IL")).toBe(true);
    expect(isHomeMarket("")).toBe(true);
  });
  it("treats other countries as non-home", () => {
    expect(isHomeMarket("US")).toBe(false);
  });
});
