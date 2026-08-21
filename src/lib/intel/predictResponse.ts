import "server-only";

import { prisma } from "@/lib/prisma";
import { gradeRows, bestVariant, PARTNER_MIN_TRIALS } from "@/lib/partner/intelligence";

/**
 * Engine 1 — institutional behaviour prediction.
 *
 * Given an institution and a claim type: are they likely to settle, for
 * roughly how much, in roughly how long, and which approach has actually
 * worked on them. Every number traces to closed cases; nothing here is
 * generated, and nothing is smoothed to look more confident than it is.
 *
 * WHAT THIS VERSION IS, stated plainly because overclaiming is the failure
 * mode that ends products like this one: it is historical base rates per
 * institution × claim type, with a confidence score. There is no model in
 * this path at all — no ensemble, no cross-model agreement term — so the
 * confidence formula has two components rather than three, and says so.
 * When a reasoning layer exists, it is added here as a third component
 * rather than quietly folded into the same number.
 *
 * The three confidence components that DO exist:
 *  - volume: how many closed cases stand behind this cell, saturating at a
 *    point past which more cases stop buying much certainty.
 *  - recency: how recent those cases are. An institution's posture in 2024
 *    predicts little about its posture today, and a stale cell should not
 *    look as trustworthy as a live one.
 *  - grade: what share of the evidence is settlement-backed — verifiable by
 *    a third party — rather than self-reported.
 */

/** Volume past which extra cases add little certainty. */
const VOLUME_SATURATION = 40;
/** Evidence older than this contributes nothing to the recency term. */
const RECENCY_HORIZON_DAYS = 540;

export interface ResponsePrediction {
  institution: string;
  claimType: string;
  /** False when the evidence is too thin to predict at all. */
  available: boolean;
  settleProbability: number | null;
  /** p25–p75 of what was actually recovered, in agorot. Never extrapolated. */
  expectedAmountRangeAgorot: { low: number; high: number } | null;
  expectedDays: number | null;
  recommendedTactic: string | null;
  /** 0–1. Its parts are exposed so anyone can audit the number. */
  confidence: number;
  confidenceParts: { volume: number; recency: number; grade: number };
  /** The evidence itself, so a caller can show the data behind the claim. */
  basis: {
    trials: number;
    wins: number;
    settlementBackedTrials: number;
    newestOutcomeDaysAgo: number | null;
    minTrials: number;
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}

export async function predictResponse(input: {
  market: string;
  vertical: string;
  counterparty: string;
  minTrials?: number;
  now?: Date;
}): Promise<ResponsePrediction> {
  const minTrials = input.minTrials ?? PARTNER_MIN_TRIALS;
  const now = input.now ?? new Date();

  const rows = await prisma.strategyOutcome.findMany({
    where: {
      market: input.market,
      vertical: input.vertical,
      counterparty: input.counterparty,
    },
    select: {
      paid: true,
      recoveredMinor: true,
      days: true,
      variantId: true,
      settlementBacked: true,
      createdAt: true,
    },
    take: 5000,
  });

  const graded = gradeRows(rows, minTrials);
  const settlementBackedTrials = rows.filter((r) => r.settlementBacked).length;
  const newestMs = rows.reduce<number | null>((acc, r) => {
    const t = r.createdAt?.getTime?.();
    if (typeof t !== "number") return acc;
    return acc === null || t > acc ? t : acc;
  }, null);
  const newestDaysAgo =
    newestMs === null ? null : Math.max(0, Math.floor((now.getTime() - newestMs) / 86_400_000));

  const basis = {
    trials: graded.trials,
    wins: graded.wins,
    settlementBackedTrials,
    newestOutcomeDaysAgo: newestDaysAgo,
    minTrials,
  };

  // Below the gate there is no prediction — not a low-confidence one, none.
  // A number an institution might act on has to be earned, and five closed
  // cases is the cheapest honest price for one.
  if (graded.trials < minTrials || graded.winRate === null) {
    return {
      institution: input.counterparty,
      claimType: input.vertical,
      available: false,
      settleProbability: null,
      expectedAmountRangeAgorot: null,
      expectedDays: null,
      recommendedTactic: null,
      confidence: 0,
      confidenceParts: { volume: 0, recency: 0, grade: 0 },
      basis,
    };
  }

  const recovered = rows
    .map((r) => r.recoveredMinor)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);

  const volume = Math.min(1, graded.trials / VOLUME_SATURATION);
  const recency =
    newestDaysAgo === null ? 0 : Math.max(0, 1 - newestDaysAgo / RECENCY_HORIZON_DAYS);
  const grade = graded.trials > 0 ? settlementBackedTrials / graded.trials : 0;

  return {
    institution: input.counterparty,
    claimType: input.vertical,
    available: true,
    settleProbability: graded.winRate,
    expectedAmountRangeAgorot:
      recovered.length > 0
        ? { low: percentile(recovered, 0.25), high: percentile(recovered, 0.75) }
        : null,
    expectedDays: graded.medianDays,
    recommendedTactic: bestVariant(rows, minTrials),
    // Weighted toward volume because it is the component that cannot be
    // faked: recent, verifiable evidence about two cases is still two cases.
    confidence: Number((0.5 * volume + 0.3 * recency + 0.2 * grade).toFixed(3)),
    confidenceParts: {
      volume: Number(volume.toFixed(3)),
      recency: Number(recency.toFixed(3)),
      grade: Number(grade.toFixed(3)),
    },
    basis,
  };
}
