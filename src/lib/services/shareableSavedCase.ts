/** Closed without a finishable action — must not pin /money?case= forever. */
export function isDeadFinishStatus(status: string): boolean {
  return status === "NO_SAVING" || status === "REVOKED";
}

/**
 * After fee is settled (or waived), rankNextAction returns start_money —
 * but prove → fee → share still needs a finish surface. Pick the newest
 * documented SAVED case that is not waiting on a success fee.
 */
export function pickShareableSavedCaseId(
  cases: Array<{
    id: string;
    status: string;
    savingsProof?: { savingMonthly: number; selfReported?: boolean | null } | null;
    fee?: { amount: number; status: string } | null;
  }>,
): string | null {
  for (const c of cases) {
    if (c.status !== "SAVED") continue;
    const proof = c.savingsProof;
    if (!proof || proof.selfReported || proof.savingMonthly <= 0) continue;
    if (c.fee?.status === "PENDING" && (c.fee.amount ?? 0) > 0) continue;
    return c.id;
  }
  return null;
}
