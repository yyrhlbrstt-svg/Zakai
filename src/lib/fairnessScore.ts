/**
 * Public fairness scores from de-identified StrategyOutcome rows only.
 * Not a subjective rating — documented win rate (paid + recovery) per counterparty.
 */
import { MIN_SAMPLE } from "@/lib/companyScore";

export interface OutcomeObservation {
  counterparty: string;
  won: boolean;
}

export interface FairnessProviderScore {
  provider: string;
  /** 0–100: share of observations with documented recovery (not legal advice). */
  fairnessScore: number;
  observations: number;
  wins: number;
  methodology: "strategy_outcome_win_rate";
}

export function aggregateFairnessScores(
  rows: OutcomeObservation[],
): FairnessProviderScore[] {
  const byProvider = new Map<string, OutcomeObservation[]>();
  for (const r of rows) {
    const arr = byProvider.get(r.counterparty) ?? [];
    arr.push(r);
    byProvider.set(r.counterparty, arr);
  }

  const out: FairnessProviderScore[] = [];
  for (const [provider, arr] of byProvider) {
    if (arr.length < MIN_SAMPLE) continue;
    const wins = arr.filter((o) => o.won).length;
    const fairnessScore = Math.round((wins / arr.length) * 100);
    out.push({
      provider,
      fairnessScore,
      observations: arr.length,
      wins,
      methodology: "strategy_outcome_win_rate",
    });
  }

  out.sort((a, b) => b.observations - a.observations);
  return out;
}
