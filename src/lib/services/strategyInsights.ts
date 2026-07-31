import "server-only";
import { prisma } from "@/lib/prisma";
import { rankVariants } from "@/lib/strategy/selector";
import { VARIANTS, variantById, variantLabel } from "@/lib/strategy/variants";
import type { Observation, StrategyContext } from "@/lib/strategy/types";

export interface StanceInsight {
  variantId: string;
  labelHe: string;
  labelEn: string;
  expectedMinor: number;
  trials: number;
  evidenceLevel: string;
}

export interface StrategyInsightsResult {
  market: string;
  totalOutcomes: number;
  winRate: number | null;
  avgRecoveredShekels: number | null;
  topStances: StanceInsight[];
}

/**
 * Aggregate Strategy Engine evidence for operator/customer transparency.
 * No PII — only anonymized StrategyOutcome rows.
 */
export async function getStrategyInsights(
  market = "IL",
  counterparty?: string,
  vertical = "telecom",
): Promise<StrategyInsightsResult> {
  try {
    const rows = await prisma.strategyOutcome.findMany({
      where: { market },
      orderBy: { createdAt: "desc" },
      take: 3000,
      select: {
        market: true,
        vertical: true,
        counterparty: true,
        variantId: true,
        paid: true,
        recoveredMinor: true,
        days: true,
      },
    });

    const totalOutcomes = rows.length;
    const wins = rows.filter((r) => r.paid);
    const winRate = totalOutcomes > 0 ? wins.length / totalOutcomes : null;
    const avgRecoveredShekels =
      wins.length > 0
        ? Math.round(wins.reduce((s, r) => s + r.recoveredMinor, 0) / wins.length / 100)
        : null;

    const context: StrategyContext = {
      market,
      vertical,
      counterparty: counterparty || "_",
    };

    const observations: Observation[] = rows.map((r) => ({
      context: {
        market: r.market,
        vertical: r.vertical,
        counterparty: r.counterparty,
      },
      variantId: r.variantId,
      paid: r.paid,
      recoveredMinor: r.recoveredMinor,
      days: r.days,
    }));

    const ranked = rankVariants(VARIANTS, observations, context).slice(0, 3);

    const topStances: StanceInsight[] = ranked.map((r) => {
      const labels = variantLabel(r.variantId);
      // Ensure variant still exists in catalog
      const v = variantById(r.variantId);
      return {
        variantId: r.variantId,
        labelHe: labels.he,
        labelEn: labels.en,
        expectedMinor: r.expectedMinor,
        trials: r.trials,
        evidenceLevel: r.evidenceLevel,
        // silence unused
        ...(v ? {} : {}),
      };
    });

    return {
      market,
      totalOutcomes,
      winRate,
      avgRecoveredShekels,
      topStances,
    };
  } catch {
    return {
      market,
      totalOutcomes: 0,
      winRate: null,
      avgRecoveredShekels: null,
      topStances: [],
    };
  }
}
