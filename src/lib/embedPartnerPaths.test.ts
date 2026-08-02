import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EMBED_PARTNER_PATH_KEYS } from "./embedPartnerPaths";

describe("partner embed.js", () => {
  const source = readFileSync("public/embed.js", "utf8");

  it("exposes every high-LTV path key", () => {
    for (const key of EMBED_PARTNER_PATH_KEYS) {
      const escaped = key.replace(/-/g, "\\-");
      const pattern = key.includes("-")
        ? new RegExp(`"${escaped}":\\s*"/`)
        : new RegExp(`${escaped}:\\s*"/`);
      expect(source, `missing embed path "${key}"`).toMatch(pattern);
    }
  });

  it("tags partner clicks for attribution", () => {
    expect(source).toContain("utm_source=embed");
    expect(source).toContain("utm_campaign=");
  });
});
