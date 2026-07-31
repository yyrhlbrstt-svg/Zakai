import { PROVIDER_KEYS } from "@/lib/providers";
import type { VerticalRulePack } from "./types";

export const telecomIL: VerticalRulePack = {
  key: "telecom",
  country: "IL",
  label: "סלולר ותקשורת",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "before_after_bill",
    proofDescription: "חשבונית חדשה שמראה סכום חודשי נמוך יותר",
  },
  regulated: false,
  counterparties: PROVIDER_KEYS,
};

/** Bank-fees graduated to full — same Case+Mandate+send+SavingsProof loop. */
export const bankFeesIL: VerticalRulePack = {
  key: "bank-fees",
  country: "IL",
  label: "עמלות בנק",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "statement_line_gone",
    proofDescription: "העמלה נעלמת מדף החשבון של החודש הבא",
  },
  regulated: false,
  counterparties: ["hapoalim", "leumi", "discount", "mizrahi", "fibi", "onezero", "other"],
};

/** Subscriptions graduated to full — cancel/retention via agent. */
export const subscriptionIL: VerticalRulePack = {
  key: "subscription",
  country: "IL",
  label: "מנויים ושירותים דיגיטליים",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "statement_line_gone",
    proofDescription: "אישור ביטול או חשבונית עם מחיר נמוך יותר / אפס",
  },
  regulated: false,
  counterparties: ["netflix", "spotify", "other"],
};

export const airlineIL: VerticalRulePack = {
  key: "airline",
  country: "IL",
  label: "פיצוי טיסה",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "transfer_confirmation",
    proofDescription: "אישור העברה / זיכוי מהחברה המציג את סכום הפיצוי",
  },
  regulated: false,
  counterparties: ["elal", "israir", "arkia", "ryanair", "easyjet", "lufthansa", "other"],
};

export const refundChaseIL: VerticalRulePack = {
  key: "refund-chase",
  country: "IL",
  label: "החזר שלא הגיע",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "transfer_confirmation",
    proofDescription: "העברה בנקאית / זיכוי כרטיס שמאשר את ההחזר",
  },
  regulated: false,
  counterparties: ["other"],
};

export const parkingIL: VerticalRulePack = {
  key: "parking",
  country: "IL",
  label: "ערעור דוח חניה",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "decision_letter",
    proofDescription: "הודעת ביטול דוח מהעירייה / רשות החניה",
  },
  regulated: false,
  counterparties: ["municipality", "other"],
};

export const transportFineIL: VerticalRulePack = {
  key: "transport-fine",
  country: "IL",
  label: "ערעור קנס תחבורה ציבורית",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "decision_letter",
    proofDescription: "הודעת ביטול קנס ממפעיל התחבורה",
  },
  regulated: false,
  counterparties: ["egged", "dan", "metropoline", "other"],
};

/** Electricity supplier switch — full agent loop (letter + Mandate + follow-up). */
export const electricityIL: VerticalRulePack = {
  key: "electricity",
  country: "IL",
  label: "חשמל — מעבר ספק",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "before_after_bill",
    proofDescription: "חשבונית חדשה מהספק החדש / הודעת ניוד שמראה תעריף נמוך יותר",
  },
  regulated: false,
  counterparties: ["electra", "cellcomEnergy", "bezeqEnergy", "partnerPower", "other"],
};

/**
 * Late-payment collection — a freelancer/small supplier chasing their own
 * client, not a consumer facing a company. One-shot recovery like
 * refund-chase/airline: amountOriginal is the invoice owed, target is 0 (full
 * payment), and the counterparty is free-text with a direct email address
 * (Case.counterpartyEmail) rather than a providers.ts registry entry.
 */
export const latePaymentIL: VerticalRulePack = {
  key: "late-payment",
  country: "IL",
  label: "איחור בתשלום לספק",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "transfer_confirmation",
    proofDescription: "אישור העברה מהלקוח על תשלום החשבונית",
  },
  regulated: false,
  counterparties: ["other"],
};

/**
 * Rental deposit return — a tenant who already vacated chasing a landlord
 * sitting on the deposit. One-shot recovery, same shape as late-payment: the
 * counterparty is the tenant's own landlord, a free-text name with a direct
 * contact email (Case.counterpartyEmail), not a providers.ts registry entry.
 */
export const depositIL: VerticalRulePack = {
  key: "deposit",
  country: "IL",
  label: "השבת פיקדון שכירות",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "transfer_confirmation",
    proofDescription: "אישור העברה מהמשכיר על השבת הפיקדון",
  },
  regulated: false,
  counterparties: ["other"],
};

export const RULE_PACKS: readonly VerticalRulePack[] = [
  telecomIL,
  bankFeesIL,
  subscriptionIL,
  airlineIL,
  refundChaseIL,
  parkingIL,
  transportFineIL,
  electricityIL,
  latePaymentIL,
  depositIL,
];
