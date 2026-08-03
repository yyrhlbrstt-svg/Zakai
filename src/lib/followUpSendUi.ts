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
  if (error === "NO_ACTIVE_MANDATE") return "NO_ACTIVE_MANDATE";
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
  if (data.sent === true || data.reason === "QUEUED") return "queued";
  return null;
}
