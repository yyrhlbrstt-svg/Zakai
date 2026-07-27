/** Deterministic bank-fee dispute letters — no AI required. */

export type BankFeeKind =
  | "account_mgmt"
  | "atm"
  | "foreign_fx"
  | "check"
  | "rejected"
  | "other";

export interface BankFeeInput {
  customerName: string;
  bank: string;
  accountLast4?: string;
  feeKind: BankFeeKind;
  feeDescription?: string;
  amountShekels?: number;
  chargeDate?: string;
}

const KIND_HE: Record<BankFeeKind, string> = {
  account_mgmt: "עמלת ניהול חשבון / פעולות",
  atm: "עמלת משיכת מזומן / כספומט",
  foreign_fx: "עמלת המרה / עסקה בחו״ל",
  check: "עמלת שיק",
  rejected: "עמלת החזרת הוראה / שיק",
  other: "עמלה",
};

export function buildBankFeeLetter(input: BankFeeInput): { subject: string; body: string } {
  const name = input.customerName.trim() || "הלקוח/ה";
  const bank = input.bank.trim() || "הבנק";
  const kindLabel = KIND_HE[input.feeKind] || KIND_HE.other;
  const desc = input.feeDescription?.trim() || kindLabel;
  const acct = input.accountLast4?.trim()
    ? `\nמספר חשבון (4 ספרות אחרונות): ${input.accountLast4.trim()}`
    : "";
  const amt =
    input.amountShekels && input.amountShekels > 0
      ? ` בסך ₪${Math.round(input.amountShekels)}`
      : "";
  const when = input.chargeDate?.trim() ? ` בתאריך ${input.chargeDate.trim()}` : "";

  return {
    subject: `בקשה לביטול / החזר עמלה — ${desc}`,
    body: `לכבוד שירות הלקוחות, ${bank},

שמי ${name}.${acct}

אני פונה בבקשה לביטול ולהחזר של ${desc}${amt}${when}.

נימוקים:
1. העמלה אינה תואמת את אופי השימוש שלי בחשבון / לא הוסברה מראש בצורה ברורה.
2. מבקש/ת לבדוק האם ניתן לסווג אותי במסלול פטור או מוזל בהתאם לפעילות בפועל.
3. ככל שהעמלה נגבתה בטעות או בניגוד לתעריפון שהוצג לי — נא להשיב את הסכום לחשבון.

מבקש/ת:
• אישור בכתב על ביטול העמלה ו/או זיכוי הסכום תוך 10 ימי עסקים
• עדכון המסלול כך שלא אחויב שוב באותה עמלה ללא הודעה מראש

בברכה,
${name}
(המכתב נוסח בסיוע זכאי — zakai)`,
  };
}
