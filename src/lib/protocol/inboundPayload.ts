/**
 * Structured Mandate inbound body attached to every provider outreach email.
 * Matches INBOUND_RECEIVE_FIELDS — institutions parse JSON, not prose.
 */

import type { EmailAttachment } from "@/lib/messaging";
import { switchingProfileForCase } from "@/lib/outreachSwitchingMeta";

export type InboundIntent =
  | "cancel"
  | "retention"
  | "switch"
  | "dispute"
  | "information_request";

export interface InboundReceivePayload {
  mandate_jws: string;
  mandate_jti: string;
  authorization_code?: string;
  subject_hint?: string;
  intent: InboundIntent;
  vertical: string;
  locale?: string;
  switching_profile_id?: string;
}

export function intentForVertical(vertical: string, strategyHint?: string): InboundIntent {
  const v = vertical.toLowerCase();
  const s = (strategyHint || "").toLowerCase();
  if (v.includes("cancel") || s.includes("ביטול") || s.includes("cancel")) return "cancel";
  if (v === "electricity" || s.includes("switch") || s.includes("מעבר")) return "switch";
  if (
    v.includes("refund") ||
    v.includes("dispute") ||
    v.includes("fine") ||
    v.includes("warranty") ||
    v.includes("deposit") ||
    v.includes("insurance") ||
    s.includes("ערעור") ||
    s.includes("החזר")
  ) {
    return "dispute";
  }
  if (v === "telecom" || v === "subscription" || s.includes("שימור") || s.includes("retention")) {
    return "retention";
  }
  return "information_request";
}

export function normalizeInboundVertical(vertical: string): string {
  const v = vertical.toLowerCase();
  if (v === "telecom" || v === "mobile") return "telecom";
  if (v === "subscription" || v.includes("cancel")) return "subscription";
  if (v === "electricity" || v === "energy") return "energy";
  if (v.includes("bank")) return "banking";
  return "other";
}

export function buildInboundReceivePayload(input: {
  mandateJws: string;
  mandateJti: string;
  authorizationCode?: string;
  caseId?: string;
  vertical: string;
  strategyHint?: string;
  locale?: string;
  market?: string;
}): InboundReceivePayload {
  const profile = switchingProfileForCase({
    vertical: input.vertical,
    market: input.market,
  });
  return {
    mandate_jws: input.mandateJws,
    mandate_jti: input.mandateJti,
    authorization_code: input.authorizationCode,
    subject_hint: input.caseId,
    intent: intentForVertical(input.vertical, input.strategyHint),
    vertical: normalizeInboundVertical(input.vertical),
    locale: input.locale,
    switching_profile_id: profile?.id,
  };
}

export function inboundReceiveEmailAttachment(payload: InboundReceivePayload): EmailAttachment {
  return {
    filename: `zakai-inbound-${payload.mandate_jti.slice(0, 12)}.json`,
    content: JSON.stringify(payload, null, 2),
    contentType: "application/json; charset=utf-8",
  };
}
