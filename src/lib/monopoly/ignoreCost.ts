/**
 * Cost of ignoring Mandate inbound — for institutions (honest, formulaic).
 * Not a threat; a ops math sheet supervisors can argue with.
 */

export interface IgnoreCostInput {
  /** Documented dispatched cases to this institution (from inbound-pressure). */
  dispatchedCases: number;
  /** Cases that reached SAVED against this counterparty. */
  savedCases: number;
  /** Minutes of human desk time assumed per unhandled Mandate email. */
  minutesPerUnhandled?: number;
  /** Fully loaded desk cost in minor units per hour (default ₪120/hr = 12000 agorot). */
  deskAgorotPerHour?: number;
}

export interface IgnoreCostResult {
  unhandledEstimate: number;
  deskHours: number;
  deskCostAgorot: number;
  reputationSignal: "none" | "emerging" | "material";
  narrative: string;
}

export function computeIgnoreCost(input: IgnoreCostInput): IgnoreCostResult {
  const minutes = input.minutesPerUnhandled ?? 8;
  const rate = input.deskAgorotPerHour ?? 12_000;
  const unhandled = Math.max(0, Math.trunc(input.dispatchedCases) - Math.trunc(input.savedCases));
  const deskHours = Math.round(((unhandled * minutes) / 60) * 10) / 10;
  const deskCostAgorot = Math.round(deskHours * rate);

  let reputationSignal: IgnoreCostResult["reputationSignal"] = "none";
  if (input.dispatchedCases >= 50) reputationSignal = "emerging";
  if (input.dispatchedCases >= 200 || input.savedCases >= 20) reputationSignal = "material";

  const narrative =
    unhandled === 0
      ? "No estimated unhandled backlog from disclosed Zakai dispatches."
      : `Estimated ${unhandled} unhandled Mandate-backed requests ≈ ${deskHours} desk-hours (~${deskCostAgorot} agorot at assumed rate) — plus fairness/regulatory visibility when sample thresholds are met.`;

  return { unhandledEstimate: unhandled, deskHours, deskCostAgorot, reputationSignal, narrative };
}
