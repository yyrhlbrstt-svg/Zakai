import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { GET as catalogGet } from "@/app/api/rights/catalog/route";
import { GET as itemGet } from "@/app/api/rights/catalog/[id]/route";
import { clearZmlCatalogCache } from "@/lib/protocol/zml/catalog";

describe("GET /api/rights/catalog", () => {
  beforeEach(() => {
    clearZmlCatalogCache();
    process.env.ZML_PACKS_LOCAL = join(process.cwd(), "zakai-packs");
  });

  it("returns IL rights summary", async () => {
    const res = await catalogGet(new Request("https://zakai.test/api/rights/catalog?market=IL"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.market).toBe("IL");
    expect(body.total).toBeGreaterThan(50);
    expect(body.rights[0]._links.self).toMatch(/^\/api\/rights\/catalog\//);
  });

  it("includes Hebrew label when locale=he", async () => {
    const res = await catalogGet(
      new Request("https://zakai.test/api/rights/catalog?market=IL&locale=he"),
    );
    const body = await res.json();
    const arnona = body.rights.find(
      (r: { id: string }) => r.id === "il_arnona_area_correction",
    );
    expect(arnona?.label).toBe("תיקון שטח נכס שגוי בארנונה");
    expect(arnona?.display_name.he).toBe("תיקון שטח נכס שגוי בארנונה");
  });

  it("returns 404 for unknown market", async () => {
    const res = await catalogGet(new Request("https://zakai.test/api/rights/catalog?market=ZZ"));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/rights/catalog/[id]", () => {
  beforeEach(() => clearZmlCatalogCache());

  it("returns full ZML with ?full=1", async () => {
    const res = await itemGet(
      new Request("https://zakai.test/api/rights/catalog/il_tax_refund?full=1"),
      { params: Promise.resolve({ id: "il_tax_refund" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("il_tax_refund");
    expect(body.source.reference).toBeTruthy();
  });
});
