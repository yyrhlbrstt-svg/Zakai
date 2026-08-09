import { buildFollowUp, type FollowUpInput, type FollowUpResult } from "./negotiation";
import { buildAirlineFollowUp } from "./flightNegotiation";
import { buildLumpFollowUp } from "./lumpNegotiation";

const LUMP_VERTICALS = new Set([
  // A baggage claim is a one-time settlement under the Montreal Convention,
  // not an airline delay payout and not a monthly bill to renegotiate.
  "baggage",
  "bank-fees",
  "bank_fees",
  "cancel",
  "subscription",
  "deposit",
  "parking",
  "warranty",
  "refund",
  "arnona",
  "duplicate-insurance",
  "duplicate_insurance",
  "transport-fine",
  "transport_fine",
  "late-payment",
  "late_payment",
  "insurance",
  "car-insurance-refund",
  "car_insurance_refund",
]);

/** Pick the right written playbook for the case vertical. */
export function buildFollowUpForVertical(
  vertical: string | null | undefined,
  input: FollowUpInput,
): FollowUpResult {
  const v = (vertical || "").trim().toLowerCase();
  if (v === "airline") return buildAirlineFollowUp(input);
  if (LUMP_VERTICALS.has(v) || v.includes("cancel") || v.includes("refund")) {
    return buildLumpFollowUp(input);
  }
  // telecom + electricity retention — monthly negotiation language
  return buildFollowUp(input);
}
