import "server-only";
import { prisma } from "@/lib/prisma";
import { predictOutcome, rankByExpectedValue, type ClaimObservation, type OutcomeQuery, type Prediction } from "./predict";
import { assessCalibration, type CalibrationReport, type Forecast } from "./calibration";

/**
 * The Oracle, connected to the ledger.
 *
 * It reads `StrategyOutcome` — the PII-free record of what was filed and
 * whether it paid — which means the asset accumulates as a by-product of doing
 * the work, not as a separate data-collection effort anyone has to fund or
 * justify. Every claim the product runs makes every future prediction better,
 * for everyone, without a single extra question asked of a user.
 */

/** Predictions are made from a rolling window: institutions change policy. */
const WINDOW_DAYS = 540;
const MAX_ROWS = 100_000;

async function loadObservations(market?: string): Promise<ClaimObservation[]> {
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const rows = await prisma.strategyOutcome.findMany({
    where: { createdAt: { gte: since }, ...(market ? { market } : {}) },
    select: {
      market: true,
      vertical: true,
      counterparty: true,
      paid: true,
      recoveredMinor: true,
      days: true,
    },
    take: MAX_ROWS,
  });
  return rows;
}

/**
 * What is this claim worth pursuing?
 *
 * Fails to an unconfident prediction rather than throwing. A caller that only
 * wanted to sort a list should not break because the ledger is slow, and a
 * caller pricing money is already required to check `confident` — which a
 * failure path correctly reports as false.
 */
export async function predict(query: OutcomeQuery): Promise<Prediction> {
  try {
    return predictOutcome(query, await loadObservations(query.market));
  } catch (err) {
    console.warn("[oracle] prediction unavailable:", err);
    return predictOutcome(query, []);
  }
}

/** Rank a person's open opportunities by expected recovery. */
export async function rank(queries: readonly OutcomeQuery[]) {
  if (queries.length === 0) return [];
  try {
    const market = queries[0].market;
    return rankByExpectedValue(queries, await loadObservations(market));
  } catch {
    return queries.map((query) => ({ query, prediction: predictOutcome(query, []) }));
  }
}

/**
 * Grade the Oracle against reality, using only claims it could not have seen.
 *
 * The split is by time, not at random. Grading a model on rows that were in its
 * own training set measures memory rather than foresight, and would report a
 * flattering number forever. Predicting the recent past from the distant past is
 * the same problem the model faces in production, which is the only version
 * worth scoring.
 *
 * Run continuously rather than once. Calibration decays on its own: counter-
 * parties change policy and the Strategy Engine changes what we send, and both
 * move the true rates under a model that has no idea anything happened.
 */
export async function assessOracleCalibration(holdoutDays = 90): Promise<CalibrationReport> {
  try {
    const cutoff = new Date(Date.now() - holdoutDays * 86_400_000);
    const all = await prisma.strategyOutcome.findMany({
      select: {
        market: true,
        vertical: true,
        counterparty: true,
        paid: true,
        recoveredMinor: true,
        days: true,
        createdAt: true,
      },
      take: MAX_ROWS,
    });

    const train = all.filter((r) => r.createdAt < cutoff);
    const test = all.filter((r) => r.createdAt >= cutoff);

    const forecasts: Forecast[] = test.map((row) => ({
      predicted: predictOutcome(
        { market: row.market, vertical: row.vertical, counterparty: row.counterparty },
        train,
      ).paidProbability,
      outcome: row.paid,
    }));

    return assessCalibration(forecasts);
  } catch (err) {
    console.warn("[oracle] calibration unavailable:", err);
    return assessCalibration([]);
  }
}
