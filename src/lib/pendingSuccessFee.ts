/** True when a success fee is still collectible (agorot — never round away sub-₪1). */
export function isPendingSuccessFee(
  fee?: { amount: number; status: string } | null,
): boolean {
  return Boolean(fee && fee.status === "PENDING" && (fee.amount ?? 0) > 0);
}

/** Display shekels for UI — keeps agorot precision under ₪1. */
export function pendingFeeDisplayShekels(amountAgorot: number): string {
  if (amountAgorot <= 0) return "0";
  if (amountAgorot % 100 === 0) return String(amountAgorot / 100);
  return (amountAgorot / 100).toFixed(2);
}
