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
  feeBasis: "monthly",
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
  feeBasis: "monthly",
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
  feeBasis: "monthly",
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
  feeBasis: "lump",
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
  feeBasis: "lump",
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
  feeBasis: "lump",
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
  feeBasis: "lump",
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
  feeBasis: "monthly",
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
  feeBasis: "lump",
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
  feeBasis: "lump",
  regulated: false,
  counterparties: ["other"],
};

export const duplicateInsuranceIL: VerticalRulePack = {
  key: "duplicate-insurance",
  country: "IL",
  label: "כפל ביטוחי — ביטול כיסוי מיותר",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "statement_line_gone",
    proofDescription: "אישור ביטול פוליסה / חשבונית עם פרמיה חודשית נמוכה יותר",
  },
  feeBasis: "monthly",
  regulated: false,
  counterparties: ["other"],
};

/** Municipal arnona discount / billing correction — decision letter proof, monthly savings. */
export const arnonaIL: VerticalRulePack = {
  key: "arnona",
  country: "IL",
  label: "ארנונה — הנחה / תיקון חיוב",
  level: "full",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "decision_letter",
    proofDescription: "החלטה מנומקת מהעירייה על הנחה או תיקון חיוב",
  },
  feeBasis: "monthly",
  regulated: false,
  counterparties: ["municipality", "other"],
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
  duplicateInsuranceIL,
  arnonaIL,
];
