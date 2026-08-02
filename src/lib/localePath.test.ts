import { describe, expect, it } from "vitest";
import { localeForCountry, localePath } from "./localePath";

describe("localePath", () => {
  it("prefixes dashboard paths", () => {
    expect(localePath("he", "/dashboard")).toBe("/he/dashboard");
    expect(localePath("en", "/dashboard?case=abc")).toBe("/en/dashboard?case=abc");
  });

  it("does not double-prefix", () => {
    expect(localePath("he", "/en/dashboard")).toBe("/en/dashboard");
  });

  it("maps IL to Hebrew", () => {
    expect(localeForCountry("IL")).toBe("he");
    expect(localeForCountry("GB")).toBe("en");
  });
});
