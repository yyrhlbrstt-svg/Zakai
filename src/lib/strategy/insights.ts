import "server-only";
import { prisma } from "@/lib/prisma";
import { variantById, describeVariant } from "./variants";

/**
 * Public-facing, privacy-safe strategy insights for the dashboard.
 * Aggregates StrategyOutcome only — never exposes user identities.
 * Minimum sample size so we never claim "learning" from noise.
 */

const MIN_TRIALS = 3;
const TOP_N = 8;

export interface CounterpartyInsight {
  counterparty: string;
  vertical: string;
  trials: number;
  winRate: number; // 0–1
  bestVariantId: string | null;
  bestVariantLabel: string | null;
  avgRecoveredMinor: number;
}

export interface StrategyInsightsSummary {
  totalOutcomes: number;
  overallWinRate: number;
  counterparties: CounterpartyInsight[];
  topStance: { id: string; label: string; trials: number; winRate: number } | null;
}

function stanceLabel(variantId: string): string {
  const v = variantById(variantId);
  if (!v) return variantId;
  const he: Record<string, string> = {
    cooperative_plain: "שיתופי",
    cooperative_anchored: "שיתופי + סכום",
    firm_statutory: "נחרץ + חוק",
    firm_statutory_anchored: "נחרץ + חוק + סכום",
    formal_escalation: "רשמי + הסלמה",
    formal_escalation_anchored: "רשמי + הסלמה + סכום",
  };
  return he[variantId] || describeVariant(v)[0] || variantId;
}

export async function getStrategyInsights(
  market = "IL",
): Promise<StrategyInsightsSummary> {
  try {
    // Self-reports included here, and this is the opposite call from the
    // oracle's — on purpose. This ranks which wording to try next, where the
    // cost of being directionally wrong is one differently-phrased letter. The
    // oracle prices things, where the cost of an inflated success rate is a
    // number somebody relies on. Same data, different stakes, different answer.
    const rows = await prisma.strategyOutcome.findMany({
      where: { market },
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        counterparty: true,
        vertical: true,
        variantId: true,
        paid: true,
        recoveredMinor: true,
      },
    });

    if (rows.length === 0) {
      return { totalOutcomes: 0, overallWinRate: 0, counterparties: [], topStance: null };
    }

    const wins = rows.filter((r) => r.paid).length;
    const overallWinRate = wins / rows.length;

    // Aggregate by counterparty
    type Bucket = {
      vertical: string;
      trials: number;
      wins: number;
      recovered: number;
      byVariant: Map<string, { trials: number; wins: number }>;
    };
    const byCp = new Map<string, Bucket>();

    for (const r of rows) {
      let b = byCp.get(r.counterparty);
      if (!b) {
        b = {
          vertical: r.vertical,
          trials: 0,
          wins: 0,
          recovered: 0,
          byVariant: new Map(),
        };
        byCp.set(r.counterparty, b);
      }
      b.trials += 1;
      if (r.paid) b.wins += 1;
      b.recovered += r.recoveredMinor;
      const vv = b.byVariant.get(r.variantId) ?? { trials: 0, wins: 0 };
      vv.trials += 1;
      if (r.paid) vv.wins += 1;
      b.byVariant.set(r.variantId, vv);
    }

    const counterparties: CounterpartyInsight[] = [...byCp.entries()]
      .filter(([, b]) => b.trials >= MIN_TRIALS)
      .map(([counterparty, b]) => {
        let bestVariantId: string | null = null;
        let bestRate = -1;
        for (const [vid, stats] of b.byVariant) {
          if (stats.trials < 2) continue;
          const rate = stats.wins / stats.trials;
          if (rate > bestRate) {
            bestRate = rate;
            bestVariantId = vid;
          }
        }
        return {
          counterparty,
          vertical: b.vertical,
          trials: b.trials,
          winRate: b.wins / b.trials,
          bestVariantId,
          bestVariantLabel: bestVariantId ? stanceLabel(bestVariantId) : null,
          avgRecoveredMinor: Math.round(b.recovered / b.trials),
        };
      })
      .sort((a, b) => b.trials - a.trials)
      .slice(0, TOP_N);

    // Global top stance
    const stanceAgg = new Map<string, { trials: number; wins: number }>();
    for (const r of rows) {
      const s = stanceAgg.get(r.variantId) ?? { trials: 0, wins: 0 };
      s.trials += 1;
      if (r.paid) s.wins += 1;
      stanceAgg.set(r.variantId, s);
    }
    let topStance: StrategyInsightsSummary["topStance"] = null;
    let topScore = -1;
    for (const [id, s] of stanceAgg) {
      if (s.trials < MIN_TRIALS) continue;
      const rate = s.wins / s.trials;
      // Prefer higher win rate, then more trials
      const score = rate * 1000 + s.trials;
      if (score > topScore) {
        topScore = score;
        topStance = { id, label: stanceLabel(id), trials: s.trials, winRate: rate };
      }
    }

    return {
      totalOutcomes: rows.length,
      overallWinRate,
      counterparties,
      topStance,
    };
  } catch {
    return { totalOutcomes: 0, overallWinRate: 0, counterparties: [], topStance: null };
  }
}
