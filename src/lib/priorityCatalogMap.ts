/**
 * Maps Case.vertical / StrategyOutcome.vertical to priority.ts CATALOG ids.
 * Some verticals use a different href than their pack key (telecom → /check).
 */
export const VERTICAL_TO_CATALOG_ID: Record<string, string> = {
  telecom: "check",
  "bank-fees": "bank-fees",
  electricity: "electricity",
  subscription: "cancel",
  "refund-chase": "refund-chase",
  airline: "flights",
  parking: "parking",
  "transport-fine": "transport-fine",
  "late-payment": "late-payment",
  deposit: "deposit",
  "duplicate-insurance": "duplicate-insurance",
  arnona: "arnona",
};
