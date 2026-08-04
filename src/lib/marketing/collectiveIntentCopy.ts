/** Collective intent form — EN + HE (phase 0; no live auction). */

export type CollectiveIntentCopy = {
  label: string;
  submit: string;
  ok: string;
  err: string;
  verticals: Array<{ id: string; label: string }>;
};

const VERTICAL_IDS = [
  "telecom",
  "car_insurance",
  "energy",
  "bank_fees",
  "subscription",
  "flight_compensation",
] as const;

const EN: CollectiveIntentCopy = {
  label: "I want group buying power for:",
  submit: "Signal intent (anonymous)",
  ok: "Recorded. No auction yet — public count only.",
  err: "Failed — try again.",
  verticals: [
    { id: "telecom", label: "Mobile / internet" },
    { id: "car_insurance", label: "Car insurance" },
    { id: "energy", label: "Energy" },
    { id: "bank_fees", label: "Bank fees" },
    { id: "subscription", label: "Subscriptions" },
    { id: "flight_compensation", label: "Flight compensation" },
  ],
};

const HE: CollectiveIntentCopy = {
  label: "אני מעוניין/ת בכוח קנייה קבוצתי ב:",
  submit: "סמן כוונה (אנונימי)",
  ok: "נרשם. אין מכרז עדיין — רק ספירה ציבורית.",
  err: "לא הצליח — נסו שוב.",
  verticals: [
    { id: "telecom", label: "סלולר / אינטרנט" },
    { id: "car_insurance", label: "ביטוח רכב" },
    { id: "energy", label: "אנרגיה" },
    { id: "bank_fees", label: "עמלות בנק" },
    { id: "subscription", label: "מנויים" },
    { id: "flight_compensation", label: "פיצוי טיסה" },
  ],
};

export function collectiveIntentCopy(locale: string): CollectiveIntentCopy {
  if (locale === "he" || locale === "ar") return HE;
  return EN;
}

export const COLLECTIVE_VERTICAL_IDS = VERTICAL_IDS;
