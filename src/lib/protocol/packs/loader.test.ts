import { describe, it, expect, beforeEach } from "vitest";
import { loadZmlRightsForMarket, invalidateZmlPackCache, loadZmlFromLocalPack } from "@/lib/protocol/packs/loader";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateZML } from "@/lib/protocol/zml/validate";

const LOCAL = join(process.cwd(), "zakai-packs");

describe("ZML pack loader", () => {
  beforeEach(() => {
    invalidateZmlPackCache();
    process.env.ZML_PACKS_LOCAL = LOCAL;
    process.env.ZML_PACKS_FALLBACK = "true";
  });

  it("local EU fixture validates", () => {
    const raw = readFileSync(join(LOCAL, "packs/eu/rights/eu_flight_delay_261.json"), "utf8");
    const doc = JSON.parse(raw);
    expect(validateZML(doc).ok).toBe(true);
    expect(loadZmlFromLocalPack("EU", LOCAL)).toHaveLength(1);
  });

  it("loads IL pack from local zakai-packs tree", async () => {
    const { rights, source } = await loadZmlRightsForMarket("IL", {
      origin: "https://zakai.test",
      forceRefresh: true,
    });
    expect(rights.length).toBe(76);
    expect(["cdn", "builtin"]).toContain(source);
  });

  it("loads EU sample from local tree", async () => {
    const { rights } = await loadZmlRightsForMarket("EU", {
      origin: "https://zakai.test",
      forceRefresh: true,
    });
    expect(rights.length).toBeGreaterThanOrEqual(1);
    expect(rights.some((r) => r.id === "eu_flight_delay_261")).toBe(true);
  });
});
