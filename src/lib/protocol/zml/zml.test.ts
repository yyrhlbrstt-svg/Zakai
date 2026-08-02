import { describe, it, expect } from "vitest";
import { IL_PACK } from "@/lib/global/packs/il";
import { GB_PACK } from "@/lib/global/packs/gb";
import { packToZmlRights } from "@/lib/protocol/zml/legacy-adapter";
import { validateZML } from "@/lib/protocol/zml/validate";
import { buildZmlCatalogForMarket, clearZmlCatalogCache } from "@/lib/protocol/zml/catalog";
import { canEvaluateZml, satisfiesZmlRange } from "@/lib/protocol/zml/compatibility";
import { ZML_VERSION } from "@/lib/protocol/zml/constants";
import type { ZmlRight } from "@/lib/protocol/zml/types";

const ORIGIN = "https://zakai.test";

describe("ZML validate", () => {
  it("accepts all IL pack rights as L0 declarative ZML", () => {
    const rights = packToZmlRights(IL_PACK, { origin: ORIGIN });
    expect(rights.length).toBe(IL_PACK.rights.length);
    for (const r of rights) {
      const v = validateZML(r);
      expect(v.ok, r.id).toBe(true);
    }
  });

  it("accepts GB pack sample", () => {
    const rights = packToZmlRights(GB_PACK, { origin: ORIGIN });
    expect(rights.length).toBeGreaterThan(0);
    for (const r of rights.slice(0, 10)) {
      expect(validateZML(r).ok).toBe(true);
    }
  });

  it("rejects wrong zml_version", () => {
    const rights = packToZmlRights(IL_PACK, { origin: ORIGIN });
    const bad = { ...rights[0], zml_version: "2.0.0" } as ZmlRight;
    expect(validateZML(bad).ok).toBe(false);
  });
});

describe("ZML compatibility", () => {
  it("matches major version", () => {
    expect(canEvaluateZml("1.0.0", "1.2.3")).toBe(true);
    expect(canEvaluateZml("2.0.0", "1.0.0")).toBe(false);
  });

  it("parses pack semver range", () => {
    expect(satisfiesZmlRange("1.0.0", ">=1.0.0 <2.0.0")).toBe(true);
    expect(satisfiesZmlRange("2.0.0", ">=1.0.0 <2.0.0")).toBe(false);
  });
});

describe("ZML catalog builder", () => {
  it("builds IL catalog with stable ids", () => {
    clearZmlCatalogCache();
    const rights = buildZmlCatalogForMarket(ORIGIN, "IL");
    expect(rights.some((r) => r.id === "il_tax_refund")).toBe(true);
    expect(rights.every((r) => r.zml_version === ZML_VERSION)).toBe(true);
  });
});

describe("ZML EU flight example (fixture)", () => {
  const eu261: ZmlRight = {
    zml_version: "1.0.0",
    id: "flight_delay_compensation_eu_261",
    display_name: {
      en: "Flight Delay Compensation (EU 261/2004)",
      he: "פיצוי על טיסה מתעכבת",
    },
    market: "FR",
    category: "transport",
    predicate: {
      operator: "AND",
      conditions: [
        { field: "flight_delay_minutes", operator: "gte", value: 180, source: "user_input" },
        { field: "flight_distance_km", operator: "lte", value: 1500, source: "user_input" },
      ],
    },
    action: {
      kind: "claim",
      auto_eligible: false,
      requires_human_gate: true,
      output_format: "email",
    },
    source: {
      type: "regulation",
      reference: "Regulation (EC) No 261/2004",
      url: "https://eur-lex.europa.eu/eli/reg/2004/261",
    },
    financial: {
      unit: "EUR",
      estimate: { typical_minor: 25000, basis: "Statutory flat rate (minor units)" },
    },
    metadata: { confidence: "high", last_verified: "2026-01-15" },
  };

  it("validates the reference EU 261 document", () => {
    expect(validateZML(eu261).ok).toBe(true);
  });
});
