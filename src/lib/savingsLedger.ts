/**
 * Public, de-identified SavingsProof / outcome gravity.
 * Machine-readable proof that Mandate-backed acts produce real money moves.
 * Never invents rows — empty ledger is honest day-one state.
 */

export interface LedgerOutcomeRow {
  vertical: string;
  /** Normalised provider key — never free-text PII. */
  counterparty: string;
  recoveredMinor: number;
  days: number;
  selfReported: boolean;
  createdAt: string; // ISO
}

export interface SavingsLedgerSnapshot {
  spec: "zakai-savings-ledger";
  version: "2026-08-03";
  disclaimer: string;
  totals: {
    /** Verified pipeline proofs only (not self-reported). */
    verifiedProofCount: number;
    verifiedRecoveredMinor: number;
    /** Includes self-reported StrategyOutcome rows — labelled, not mixed silently. */
    allOutcomeCount: number;
    allRecoveredMinor: number;
  };
  recent: LedgerOutcomeRow[];
}

export function buildSavingsLedgerSnapshot(input: {
  verifiedProofCount: number;
  verifiedRecoveredMinor: number;
  outcomes: ReadonlyArray<{
    vertical: string;
    counterparty: string;
    recoveredMinor: number;
    days: number;
    selfReported: boolean;
    createdAt: Date;
  }>;
}): SavingsLedgerSnapshot {
  const allRecoveredMinor = input.outcomes.reduce((s, r) => s + Math.max(0, r.recoveredMinor), 0);
  return {
    spec: "zakai-savings-ledger",
    version: "2026-08-03",
    disclaimer:
      "De-identified aggregates and recent outcomes only. No user/case ids. Empty totals mean the loop is young — not fabricated traction.",
    totals: {
      verifiedProofCount: input.verifiedProofCount,
      verifiedRecoveredMinor: input.verifiedRecoveredMinor,
      allOutcomeCount: input.outcomes.length,
      allRecoveredMinor,
    },
    recent: input.outcomes.map((r) => ({
      vertical: r.vertical,
      counterparty: r.counterparty,
      recoveredMinor: r.recoveredMinor,
      days: r.days,
      selfReported: r.selfReported,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
