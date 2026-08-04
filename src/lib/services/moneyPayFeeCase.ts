import { feeConfirmAutoCheckout } from "@/lib/feeConfirmNotify";
import { isPendingSuccessFee } from "@/lib/pendingSuccessFee";

/**
 * Which case's FeePayButton mounts on /money.
 * Focus wins only when that case has a PENDING fee **and** ACTIVE Mandate —
 * otherwise checkout refuses (#88). Mock PSP may still mount for manual E2E;
 * autoStart / payFee=1 is gated separately via paymentsLive.
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
 * Strip / deep-link for a PENDING fee: invent payFee=1 only when Mandate is
 * ACTIVE and a real PSP is configured. Otherwise land on the case surface.
 */
export function moneyPendingFeeHref(opts: {
  caseId: string;
  mandateActive: boolean;
  paymentsLive: boolean;
}): string {
  return feeConfirmAutoCheckout(opts)
    ? `/money?case=${opts.caseId}&payFee=1`
    : `/money?case=${opts.caseId}`;
}
