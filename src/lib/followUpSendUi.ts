/**
 * Shared SENT follow-up send classification for CaseNextStep + OvernightAgent.
 * Keep error → CTA mapping in one place so Mandate recovery stays consistent.
 */

export type FollowUpSendBlock =
  | "NEEDS_OUTREACH_EMAIL"
  | "NO_ACTIVE_MANDATE"
  | "NO_TRANSPORT"
  | "OUTREACH_DELIVERY_FAILED"
  | "MAX_ROUNDS"
  | "generic";

export function classifyFollowUpSendError(error: unknown): FollowUpSendBlock {
  if (error === "NEEDS_OUTREACH_EMAIL") return "NEEDS_OUTREACH_EMAIL";
  // Keys live without machine JWS — same recovery as revoked/missing auth (reissue).
  if (error === "NO_ACTIVE_MANDATE" || error === "MANDATE_REQUIRED") {
    return "NO_ACTIVE_MANDATE";
  }
  if (error === "NO_TRANSPORT") return "NO_TRANSPORT";
  if (error === "OUTREACH_DELIVERY_FAILED") return "OUTREACH_DELIVERY_FAILED";
  if (error === "MAX_ROUNDS") return "MAX_ROUNDS";
  return "generic";
}

/** Green "sent to provider" only when SMTP actually accepted the message. */
export type FollowUpDeliveryUi = "delivered" | "queued";

export function followUpDeliveryState(data: {
  sent?: boolean;
  delivered?: boolean;
  reason?: string;
}): FollowUpDeliveryUi | null {
  if (data.delivered === true) return "delivered";
  // `sent: true` means accepted into Outbox (QUEUED or SENT) — not "delivered".
  if (data.sent === true || data.reason === "QUEUED") return "queued";
  return null;
}

/**
 * Map Outbox row status after a follow-up dispatch.
 * `sent` = accepted into the delivery pipeline; `delivered` = SMTP accepted.
 */
export function followUpDispatchOutcome(status: string): {
  sent: true;
  delivered: boolean;
  reason?: "QUEUED";
} {
  const delivered = status === "SENT";
  return delivered
    ? { sent: true, delivered: true }
    : { sent: true, delivered: false, reason: "QUEUED" };
}
