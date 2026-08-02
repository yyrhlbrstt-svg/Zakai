import { describe, expect, it } from "vitest";
import { PROTOCOL_LAWS, WELL_KNOWN_RELATIVE } from "./laws";

describe("protocol laws", () => {
  it("has stable ids", () => {
    const ids = PROTOCOL_LAWS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("no_outbound_money_scopes");
  });

  it("well-known paths are absolute-ready", () => {
    expect(WELL_KNOWN_RELATIVE.protocol).toMatch(/^\/\.well-known\//);
  });
});

describe("buildZakaiProtocolDocument", () => {
  it("includes all layers", async () => {
    const { buildZakaiProtocolDocument } = await import("./discovery");
    const doc = buildZakaiProtocolDocument("https://zakai.example");
    expect(doc.spec).toBe("zakai-protocol");
    expect(doc.layers.authority.jwks).toContain("zakai-jwks");
    expect(doc.laws.length).toBeGreaterThanOrEqual(5);
    expect(doc.zml?.rights_catalog).toContain("/api/rights/catalog");
  });
});
