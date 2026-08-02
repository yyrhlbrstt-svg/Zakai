import { describe, it, expect } from "vitest";
import {
  marketFromGeoCountry,
  resolveVisitorMarket,
  isCatalogMarket,
  rightsDefaultCountry,
} from "./marketGeo";

describe("marketGeo", () => {
  it("maps Israel geo to IL", () => {
    expect(marketFromGeoCountry("IL")).toBe("IL");
  });

  it("maps missing geo to US default", () => {
    expect(marketFromGeoCountry("")).toBe("US");
  });

  it("maps unknown EU member to EU catalog", () => {
    expect(marketFromGeoCountry("PT")).toBe("EU");
  });

  it("prefers valid cookie over geo", () => {
    expect(resolveVisitorMarket("FR", "US")).toBe("FR");
  });

  it("falls back to geo when cookie invalid", () => {
    expect(resolveVisitorMarket("ZZ", "DE")).toBe("DE");
  });

  it("treats EU as catalog market", () => {
    expect(isCatalogMarket("EU")).toBe(true);
  });

  it("maps GB market to UK rights country", () => {
    expect(rightsDefaultCountry("GB")).toBe("UK");
  });
});
