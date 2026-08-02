import { VERTICAL_TO_CATALOG_ID } from "@/lib/priorityCatalogMap";

export type OutcomeRow = {
  vertical: string;
  paid: boolean;
  recoveredMinor: number;
};

const MIN_TRIALS = 5;
const MAX_BOOST = 0.28;

/**
 * Turn de-identified StrategyOutcome aggregates into per-catalog-id ranking
 * multipliers (0–0.28). Empty when evidence is thin — ranking stays static.
 */
export function catalogBoostsFromOutcomes(rows: readonly OutcomeRow[]): Record<string, number> {
  const byVertical = new Map<string, { n: number; wins: number; recovered: number }>();
  for (const r of rows) {
    const cur = byVertical.get(r.vertical) ?? { n: 0, wins: 0, recovered: 0 };
    cur.n += 1;
    if (r.paid) {
      cur.wins += 1;
      cur.recovered += Math.max(0, r.recoveredMinor);
    }
    byVertical.set(r.vertical, cur);
  }

  const boosts: Record<string, number> = {};
  for (const [vertical, stats] of byVertical) {
    if (stats.n < MIN_TRIALS) continue;
    const winRate = stats.wins / stats.n;
    const avgRecovered =
      stats.wins > 0 ? stats.recovered / stats.wins / 100 : 0; // shekels
    const ev = winRate * avgRecovered;
    if (ev <= 0) continue;
    const catalogId = VERTICAL_TO_CATALOG_ID[vertical] ?? vertical;
    const boost = Math.min(MAX_BOOST, ev / 400);
    boosts[catalogId] = Math.max(boosts[catalogId] ?? 0, boost);
  }
  return boosts;
}
