/**
 * Pure selection for paste → SavingsProof field.
 * One-tap only from a real Outbox proposal; otherwise fill mapped record amount.
 * Never trust raw extract.newAmountShekels (lump refund ≠ remaining owed).
 */

export type PasteRecordDecision =
  | { kind: "proposed"; newAmountShekels: number; confidence: number }
  | { kind: "mapped"; newAmountShekels: number }
  | { kind: "none" };

export function resolvePasteRecordField(data: {
  proposed?: { newAmountShekels: number; confidence: number } | null;
  recordAmountShekels?: number | null;
  /** Ignored for fill/one-tap — kept so call sites can pass the API body as-is. */
  extract?: { newAmountShekels?: number | null } | null;
}): PasteRecordDecision {
  if (data.proposed?.newAmountShekels != null) {
    return {
      kind: "proposed",
      newAmountShekels: data.proposed.newAmountShekels,
      confidence: data.proposed.confidence ?? 0,
    };
  }
  if (data.recordAmountShekels != null && data.recordAmountShekels >= 0) {
    return { kind: "mapped", newAmountShekels: data.recordAmountShekels };
  }
  return { kind: "none" };
}
