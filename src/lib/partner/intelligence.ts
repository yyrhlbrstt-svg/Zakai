import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Partner intelligence — the one question no frontier model can answer.
 *
 * A model can reason about consumer law better than most people. What it
 * cannot know is which approach actually recovered money from a specific
 * company last month, how long that took, and whether the number behind that
 * claim is a signed settlement or somebody's own report. That lives in one
 * place: the outcome graph this product writes every time a case closes.
 *
 * So this is deliberately NOT a wrapper around a language model. It is the
 * proprietary half — the half that improves with volume and that no amount of
 * model capability substitutes for. A partner brings their own model; what
 * they buy here is the evidence to point it at.
 *
 * HONESTY RULES, enforced below rather than promised:
 *  - Below the sample gate no rate or average is returned at all. A win rate
 *    over two cases is noise wearing a percentage sign, and handing that to an
 *    institution that will act on it is worse than handing them nothing.
 *  - Settlement-backed rows are counted SEPARATELY from self-reported ones.
 *    Anyone can verify the first against the published key; the second is our
 *    own assertion. Blending them would hide the distinction that makes the
 *    number worth paying for.
 *  - Zero is returned as zero, with the count, never as an empty response a
 *    caller could mistake for an error.
 */

/** Below this, no rate is published. */
export const PARTNER_MIN_TRIALS = 5;

export interface EvidenceGrade {
  trials: number;
  wins: number;
  winRate: number | null;
  avgRecoveredMinor: number | null;
  medianDays: number | null;
}

export interface PartnerIntelligence {
  market: string;
  vertical: string;
  counterparty: string;
  minTrials: number;
  all: EvidenceGrade;
  /** Backed by a signed settlement — independently verifiable. */
  settlementBacked: EvidenceGrade;
  /** Our own assertion, not verifiable by the reader. */
  selfReported: EvidenceGrade;
  bestVariantId: string | null;
  /** Present when an aggregate was withheld, with the numbers behind it. */
  insufficientEvidence: { held: number; needed: number } | null;
}

interface Row {
  paid: boolean;
  recoveredMinor: number | null;
  days: number | null;
  variantId: string;
  settlementBacked: boolean;
}

export function gradeRows(rows: Row[], minTrials: number): EvidenceGrade {
  const trials = rows.length;
  const wins = rows.filter((r) => r.paid).length;
  if (trials < minTrials) {
    // Counts stay true at any size; rates and averages do not.
    return { trials, wins, winRate: null, avgRecoveredMinor: null, medianDays: null };
  }
  const recovered = rows
    .map((r) => r.recoveredMinor)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const days = rows
    .map((r) => r.days)
    .filter((v): v is number => typeof v === "number" && v >= 0)
    .sort((a, b) => a - b);
  return {
    trials,
    wins,
    winRate: wins / trials,
    avgRecoveredMinor: recovered.length
      ? Math.round(recovered.reduce((a, b) => a + b, 0) / recovered.length)
      : null,
    medianDays: days.length ? days[Math.floor(days.length / 2)] : null,
  };
}

export function bestVariant(rows: Row[], minTrials: number): string | null {
  const byVariant = new Map<string, { trials: number; wins: number }>();
  for (const r of rows) {
    const cur = byVariant.get(r.variantId) ?? { trials: 0, wins: 0 };
    cur.trials += 1;
    if (r.paid) cur.wins += 1;
    byVariant.set(r.variantId, cur);
  }
  let best: { id: string; rate: number } | null = null;
  for (const [id, v] of byVariant) {
    if (v.trials < minTrials) continue;
    const rate = v.wins / v.trials;
    if (!best || rate > best.rate) best = { id, rate };
  }
  return best?.id ?? null;
}

export async function getPartnerIntelligence(input: {
  market: string;
  vertical: string;
  counterparty: string;
  minTrials?: number;
}): Promise<PartnerIntelligence> {
  const minTrials = input.minTrials ?? PARTNER_MIN_TRIALS;
  const rows = (await prisma.strategyOutcome.findMany({
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
    },
    take: 5000,
  })) as Row[];

  const all = gradeRows(rows, minTrials);
  return {
    market: input.market,
    vertical: input.vertical,
    counterparty: input.counterparty,
    minTrials,
    all,
    settlementBacked: gradeRows(rows.filter((r) => r.settlementBacked), minTrials),
    selfReported: gradeRows(rows.filter((r) => !r.settlementBacked), minTrials),
    bestVariantId: all.trials >= minTrials ? bestVariant(rows, minTrials) : null,
    insufficientEvidence:
      all.trials >= minTrials ? null : { held: all.trials, needed: minTrials },
  };
}
