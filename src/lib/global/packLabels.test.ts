import { describe, expect, it } from "vitest";
import { allMarkets } from "./registry";
import { PACK_RIGHT_LABELS } from "./packLabels.generated";
import { packRightUILabel } from "./packLabels";

describe("pack right UI labels", () => {
  it("covers every non-IL pack right", () => {
    const missing: string[] = [];
    for (const market of allMarkets()) {
      if (market.code === "IL") continue;
      for (const right of market.pack.rights) {
        const key = `${market.code}:${right.id}`;
        if (!PACK_RIGHT_LABELS[key]?.en || !PACK_RIGHT_LABELS[key]?.he) {
          missing.push(key);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("resolves Hebrew and English titles", () => {
    expect(packRightUILabel("NL", "nl_zorgtoeslag", "he")).toContain("זורג");
    expect(packRightUILabel("GB", "pension_credit", "en")?.length).toBeGreaterThan(3);
  });
});
