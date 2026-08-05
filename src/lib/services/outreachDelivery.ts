/**
 * Map latest outreach Outbox row → finish-surface honesty banner.
 * Pure — MoneyLoopCloser loads the row; CaseNextStep only needs the enum.
 */
export type OutreachDelivery = "delivered" | "queued" | "failed" | "none";

export function mapOutboxToOutreachDelivery(
  row:
    | {
        status: string;
        providerMessageId?: string | null;
      }
    | null
    | undefined,
): OutreachDelivery {
  if (!row) return "none";
  // Markers used when nothing was offered to a transport.
  if (row.providerMessageId === "inbound") return "none";
  if (row.providerMessageId === "no-transport") return "failed";
  if (row.status === "SENT") return "delivered";
  if (row.status === "QUEUED") return "queued";
  if (row.status === "FAILED") return "failed";
  return "none";
}
