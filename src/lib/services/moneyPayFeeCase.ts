import { isPendingSuccessFee } from "@/lib/pendingSuccessFee";

/**
 * Which case's FeePayButton auto-starts / mounts on /money?payFee=1.
 * Focus wins only when that case actually has a PENDING fee in agorot.
 */
export function resolveMoneyPayFeeCaseId(opts: {
  payFee: boolean;
  focusCaseId?: string | null;
  cases: Array<{
    id: string;
    fee?: { amount: number; status: string } | null;
  }>;
}): string | null {
  const pending = opts.cases.filter((c) => isPendingSuccessFee(c.fee));
  if (pending.length === 0) return null;
  if (opts.payFee && opts.focusCaseId) {
    const focused = pending.find((c) => c.id === opts.focusCaseId);
    if (focused) return focused.id;
  }
  return pending[0]?.id ?? null;
}
