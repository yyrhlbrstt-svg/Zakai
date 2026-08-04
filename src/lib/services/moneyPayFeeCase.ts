import { isPendingSuccessFee } from "@/lib/pendingSuccessFee";

/**
 * Which case's FeePayButton auto-starts / mounts on /money?payFee=1.
 * Focus wins only when that case has a PENDING fee **and** ACTIVE Mandate —
 * otherwise checkout refuses (#88) and autoStart is a dead-end loop.
 */
export function resolveMoneyPayFeeCaseId(opts: {
  payFee: boolean;
  focusCaseId?: string | null;
  cases: Array<{
    id: string;
    fee?: { amount: number; status: string } | null;
    authorization?: { status: string } | null;
  }>;
}): string | null {
  const pending = opts.cases.filter(
    (c) => isPendingSuccessFee(c.fee) && c.authorization?.status === "ACTIVE",
  );
  if (pending.length === 0) return null;
  if (opts.payFee && opts.focusCaseId) {
    const focused = pending.find((c) => c.id === opts.focusCaseId);
    if (focused) return focused.id;
  }
  return pending[0]?.id ?? null;
}

/**
 * Strip / deep-link for a PENDING fee: checkout only when Mandate is ACTIVE.
 * Inactive → case finish surface (reissue) without inventing payFee=1.
 */
export function moneyPendingFeeHref(opts: {
  caseId: string;
  mandateActive: boolean;
}): string {
  return opts.mandateActive
    ? `/money?case=${opts.caseId}&payFee=1`
    : `/money?case=${opts.caseId}`;
}
