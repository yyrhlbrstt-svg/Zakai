import "server-only";
import { prisma } from "@/lib/prisma";
import { catalogBoostsFromOutcomes } from "@/lib/priorityOutcomeBoost";

const WINDOW_DAYS = 540;

/** Verified StrategyOutcome evidence for priority ranking (IL default). */
export async function getPriorityCatalogBoosts(market = "IL"): Promise<Record<string, number>> {
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    const rows = await prisma.strategyOutcome.findMany({
      where: { market, createdAt: { gte: since }, selfReported: false },
      select: { vertical: true, paid: true, recoveredMinor: true },
      take: 50_000,
    });
    return catalogBoostsFromOutcomes(rows);
  } catch {
    return {};
  }
}
