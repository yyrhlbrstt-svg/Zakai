import { describe, expect, it } from "vitest";
import { buildPacksManifest } from "./manifest";

describe("buildPacksManifest", () => {
  it("exposes catalog and packs discovery URLs", () => {
    const m = buildPacksManifest("https://example.test");
    expect(m.spec).toBe("zakai-packs");
    expect(m.endpoints.catalog).toContain("/api/rights/catalog");
    expect(m.schema).toContain("zakai-rights-schema");
    expect(m.repository.validate).toBe("npm run packs:validate");
  });
});
