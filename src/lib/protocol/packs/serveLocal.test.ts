import { describe, expect, it } from "vitest";
import { buildOriginPacksManifest, packsRoot, readPackArtifact } from "./serveLocal";

describe("serveLocal packs CDN mirror", () => {
  it("finds bundled packs root", () => {
    expect(packsRoot()).toBeTruthy();
  });

  it("serves IL index", () => {
    const art = readPackArtifact("il/index.json");
    expect(art).not.toBeNull();
    const json = JSON.parse(art!.body);
    expect(json.market).toBe("IL");
    expect(Array.isArray(json.rights)).toBe(true);
    expect(json.rights.length).toBeGreaterThan(50);
  });

  it("builds origin manifest", () => {
    const root = packsRoot()!;
    const m = buildOriginPacksManifest(root);
    expect(m.markets).toContain("il");
  });
});
