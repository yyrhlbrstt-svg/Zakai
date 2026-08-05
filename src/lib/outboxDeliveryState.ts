/**
 * Honest Outbox delivery classification — never treat QUEUED as "נשלח".
 */
export type OutboxDeliveryState = "sent" | "queued" | "failed" | "none";

export function outboxDeliveryState(
  status: string | null | undefined,
): OutboxDeliveryState {
  if (status === "SENT") return "sent";
  if (status === "QUEUED") return "queued";
  if (status === "FAILED") return "failed";
  return "none";
}

export function isOutboxDelivered(status: string | null | undefined): boolean {
  return outboxDeliveryState(status) === "sent";
}

export function isOutboxAccepted(status: string | null | undefined): boolean {
  const s = outboxDeliveryState(status);
  return s === "sent" || s === "queued";
}
