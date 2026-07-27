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

export const bankFeesIL: VerticalRulePack = {
  key: "bank-fees",
  country: "IL",
  label: "עמלות בנק",
  level: "assisted",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "statement_line_gone",
    proofDescription: "העמלה נעלמת מדף החשבון של החודש הבא",
  },
  regulated: false,
  counterparties: ["hapoalim", "leumi", "discount", "mizrahi", "fibi", "onezero", "other"],
};

export const subscriptionIL: VerticalRulePack = {
  key: "subscription",
  country: "IL",
  label: "מנויים ושירותים דיגיטליים",
  level: "assisted",
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
  level: "assisted",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "transfer_confirmation",
    proofDescription: "אישור העברה / זיכוי מהחברה המציג את סכום הפיצוי",
  },
  regulated: false,
  counterparties: ["elal", "israir", "arkia", "ryanair", "easyjet", "lufthansa", "other"],
};

/** Missing refund chase — one-shot recovery of a promised transfer. */
export const refundChaseIL: VerticalRulePack = {
  key: "refund-chase",
  country: "IL",
  label: "החזר שלא הגיע",
  level: "assisted",
  feeRateBps: null,
  channel: "email",
  verification: {
    method: "transfer_confirmation",
    proofDescription: "העברה בנקאית / זיכוי כרטיס שמאשר את ההחזר",
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
];
