import { PROVIDER_KEYS } from "@/lib/providers";
import type { VerticalRulePack } from "./types";

/**
 * Telecom, Israel — the proven full-service vertical. This pack encodes what
 * the core flow does today, so wiring the core to read it changes NOTHING for
 * the end user (the Stage-0 regression guarantee). Fee rate is `null` = the
 * user's plan rate, preserving "the subscription buys the fee down".
 */
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

/**
 * Bank fees, Israel — the next vertical to become full-service (Group A: simple
 * verification, low regulatory risk). Starts at `assisted` — it acts as a
 * drafter + guide until the "the charge disappears from the next statement"
 * verification and a real case flow are wired and proven on real cases. This is
 * the honest gate: it does NOT charge a fee while `level !== "full"`.
 */
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

/** Every registered rule pack. New (vertical × country) = a new entry here. */
export const RULE_PACKS: readonly VerticalRulePack[] = [telecomIL, bankFeesIL];
