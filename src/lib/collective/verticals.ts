/** Closed set for anonymous collective intent — no free text (PII-safe). */
export const COLLECTIVE_VERTICALS = [
  "telecom",
  "car_insurance",
  "energy",
  "bank_fees",
  "subscription",
  "flight_compensation",
] as const;

export type CollectiveVertical = (typeof COLLECTIVE_VERTICALS)[number];

export function isCollectiveVertical(v: string): v is CollectiveVertical {
  return (COLLECTIVE_VERTICALS as readonly string[]).includes(v);
}
