import "server-only";

import { prisma } from "@/lib/prisma";
import { backfillSettledLearningSignals } from "@/lib/strategy/learningSignal";
import { cohortLearning, type LearningOutcomeRow } from "@/lib/strategy/learningInsights";
import { isCatalogVariantId } from "@/lib/strategy/normalizeKeys";
import type { AutopilotJobResult } from "../findings";

const WINDOW_DAYS = 30;

/**
 * Outcome learner — background only. Never blocks the user loop.
 * 1) Backfill missing StrategyOutcome rows for settled cases
 * 2) Report explainable stance / vertical stats from verified outcomes
 */
export async function runOutcomeLearner(): Promise<AutopilotJobResult> {
  const backfill = await backfillSettledLearningSignals({ take: 40 });

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const rows = await prisma.strategyOutcome.findMany({
    where: { createdAt: { gte: since }, selfReported: false },
    select: {
      vertical: true,
      variantId: true,
      paid: true,
      recoveredMinor: true,
      market: true,
      counterparty: true,
      days: true,
      selfReported: true,
    },
  });

  const byVariant = new Map<string, { total: number; wins: number; recovered: number }>();
  for (const r of rows) {
    if (!isCatalogVariantId(r.variantId)) continue;
    const key = `${r.market}:${r.vertical}:${r.variantId}`;
    const cur = byVariant.get(key) ?? { total: 0, wins: 0, recovered: 0 };
    cur.total++;
    if (r.paid && r.recoveredMinor > 0) {
      cur.wins++;
      cur.recovered += r.recoveredMinor;
    }
    byVariant.set(key, cur);
  }

  const variantStats = [...byVariant.entries()]
    .map(([key, s]) => ({
      key,
      winRate: s.total > 0 ? s.wins / s.total : 0,
      ...s,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  // Surface a few explainable cohort leaders for the autopilot digest.
  const cohortKeys = new Set(
    rows.map((r) => `${r.market}::${r.vertical}::${r.counterparty}`),
  );
  const leaders: string[] = [];
  for (const key of cohortKeys) {
    if (leaders.length >= 5) break;
    const [market, vertical, counterparty] = key.split("::") as [string, string, string];
    const cohort = cohortLearning(rows as LearningOutcomeRow[], market, vertical, counterparty);
    if (cohort?.bestStance && cohort.trials >= 5) {
      leaders.push(
        `${counterparty}/${vertical}: ${cohort.bestStance.variantId} (${(cohort.bestStance.winRate * 100).toFixed(0)}% n=${cohort.bestStance.trials})`,
      );
    }
  }

  const findings: AutopilotJobResult["findings"] = variantStats
    .filter((v) => v.total >= 5 && v.winRate < 0.2)
    .map((v) => ({
      kind: "low_win_rate_variant",
      severity: "warning" as const,
      message: `Low win rate for ${v.key} (${(v.winRate * 100).toFixed(0)}% over ${v.total})`,
      meta: v,
    }));

  if (leaders.length > 0) {
    findings.push({
      kind: "stance_leaders",
      severity: "note",
      message: `Explainable stance leaders: ${leaders.join("; ")}`,
      meta: { leaders },
    });
  }

  return {
    ok: true,
    summary: `Outcome Learner: ${rows.length} verified outcomes in ${WINDOW_DAYS}d; backfill examined=${backfill.examined} recorded=${backfill.recorded}. Leaders: ${leaders.length}.`,
    findings,
  };
}
