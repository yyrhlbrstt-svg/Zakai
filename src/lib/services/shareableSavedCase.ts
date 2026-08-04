/** Closed without a finishable action — must not pin /money?case= forever. */
export function isDeadFinishStatus(status: string): boolean {
  return status === "NO_SAVING" || status === "REVOKED";
}

type FinishCaseRow = {
  id: string;
  status: string;
  savingsProof?: { savingMonthly: number; selfReported?: boolean | null } | null;
  fee?: { amount: number; status: string } | null;
};

/**
 * After documented SAVED, pick a finish surface for share / referral.
 * Pending success fee must NOT kill virality — prove→fee and prove→share run
 * in parallel (SCALE_DISTRIBUTION). Self-reported estimates stay excluded.
 */
export function pickShareableSavedCaseId(cases: FinishCaseRow[]): string | null {
  for (const c of cases) {
    if (c.status !== "SAVED") continue;
    const proof = c.savingsProof;
    if (!proof || proof.selfReported || proof.savingMonthly <= 0) continue;
    return c.id;
  }
  return null;
}

/**
 * Which CaseNextStep mounts on /money.
 * Live open-loop beats a dead ?case= pin (NO_SAVING / REVOKED).
 * After ranker returns start_money, keep share CTAs via pickShareableSavedCaseId.
 */
export function resolveMoneyFinishCaseId(opts: {
  cases: FinishCaseRow[];
  focusCaseId?: string | null;
  rankedCaseId?: string | null;
}): string | null {
  const { cases, focusCaseId, rankedCaseId } = opts;
  const focused =
    focusCaseId && cases.some((row) => row.id === focusCaseId) ? focusCaseId : null;
  if (focused) {
    const row = cases.find((c) => c.id === focused)!;
    if (isDeadFinishStatus(row.status) && rankedCaseId) {
      return rankedCaseId;
    }
    return focused;
  }
  return rankedCaseId ?? pickShareableSavedCaseId(cases);
}
