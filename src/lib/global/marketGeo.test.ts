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

  it("maps missing geo to international XX pack", () => {
    expect(marketFromGeoCountry("")).toBe("XX");
  });

  it("maps unknown EU member to EU pack", () => {
    expect(marketFromGeoCountry("PT")).toBe("EU");
  });

  it("maps non-pack countries to XX so everyone can use letters/tools", () => {
    expect(marketFromGeoCountry("NG")).toBe("XX");
    expect(marketFromGeoCountry("KR")).toBe("XX");
  });

  it("maps dedicated packs by iso", () => {
    expect(marketFromGeoCountry("BR")).toBe("BR");
    expect(marketFromGeoCountry("JP")).toBe("JP");
  });

  it("prefers valid cookie over geo", () => {
    expect(resolveVisitorMarket("FR", "US")).toBe("FR");
  });

  it("falls back to geo when cookie invalid", () => {
    expect(resolveVisitorMarket("ZZ", "DE")).toBe("DE");
  });

  it("treats EU and XX as selectable markets", () => {
    expect(isCatalogMarket("EU")).toBe(true);
    expect(isCatalogMarket("XX")).toBe(true);
  });

  it("maps GB market to UK rights country", () => {
    expect(rightsDefaultCountry("GB")).toBe("UK");
  });
});
