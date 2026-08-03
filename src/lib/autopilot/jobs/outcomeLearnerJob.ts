import "server-only";

import { prisma } from "@/lib/prisma";
import type { AutopilotJobResult } from "../findings";

const WINDOW_DAYS = 30;

export async function runOutcomeLearner(): Promise<AutopilotJobResult> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const rows = await prisma.strategyOutcome.findMany({
    where: { createdAt: { gte: since } },
    select: { vertical: true, variantId: true, paid: true, recoveredMinor: true, market: true },
  });

  const byVariant = new Map<string, { total: number; wins: number; recovered: number }>();
  for (const r of rows) {
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

  const evolveNote =
    "Template promotion runs via /api/cron/evolve (daily); this job reports variant stats only.";

  const findings: AutopilotJobResult["findings"] = variantStats
    .filter((v) => v.total >= 5 && v.winRate < 0.2)
    .map((v) => ({
      kind: "low_win_rate_variant",
      severity: "warning" as const,
      message: `Low win rate for ${v.key} (${(v.winRate * 100).toFixed(0)}% over ${v.total})`,
      meta: v,
    }));

  return {
    ok: true,
    summary: `Outcome Learner: ${rows.length} outcomes in ${WINDOW_DAYS}d. ${evolveNote}`,
    findings,
  };
}
