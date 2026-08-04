import "server-only";

import { prisma } from "@/lib/prisma";
import { allMarkets } from "@/lib/global/registry";
import { isCatalogMarket } from "@/lib/global/marketGeo";
import type { AutopilotJobResult } from "../findings";

export async function runMarketExpander(): Promise<AutopilotJobResult> {
  const known = new Set(allMarkets().map((m) => m.code));
  const rows = await prisma.collectiveIntentSignal
    .groupBy({
      by: ["market"],
      _count: { _all: true },
    })
    .catch(() => [] as { market: string; _count: { _all: number } }[]);

  const findings: AutopilotJobResult["findings"] = [];

  for (const row of rows) {
    const code = row.market.toUpperCase();
    if (known.has(code) || !isCatalogMarket(code)) continue;
    if (row._count._all < 10) continue;
    findings.push({
      kind: "market_demand_without_pack",
      severity: "note",
      message: `${code} has ${row._count._all} collective intent signals but no full pack`,
      meta: { market: code, signals: row._count._all },
    });
  }

  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.AUTOPILOT_GITHUB_REPO?.trim();
  if (token && repo && findings.length > 0) {
    for (const f of findings.slice(0, 3)) {
      const market = String(f.meta?.market ?? "");
      await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `[market-expander] Maintainer wanted: ${market}`,
          body: `Collective intent signals: ${f.meta?.signals}\n\nSee docs/COUNTRY_PACKS.md`,
          labels: ["market-expander", "autopilot"],
        }),
      }).catch(() => undefined);
    }
  }

  return {
    ok: true,
    summary: `Market Expander: ${findings.length} market(s) with demand signals.`,
    findings,
  };
}
