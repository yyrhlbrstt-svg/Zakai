/**
 * Deterministic card-clearing (סליקה) fee renegotiation letters — no AI.
 *
 * WHY THIS VERTICAL EXISTS
 *
 * Every Israeli business that takes card payments pays a clearing fee on each
 * transaction, plus fixed monthly charges for the terminal and services. The
 * headline rate is negotiable and routinely is negotiated — by chains, with
 * procurement staff. A one-person עוסק מורשה signs whatever the acquirer's
 * salesperson put in front of them and never revisits it, so the same shop
 * can pay materially more per transaction than a larger competitor for an
 * identical swipe.
 *
 * That makes it the most under-collected recurring money a small Israeli
 * business has: it is charged monthly, it compounds with revenue, and asking
 * costs nothing. It also fits Zakai's loop exactly — a named counterparty, a
 * written request, and a saving that shows up as a lower rate on next month's
 * statement, which is a documentable SavingsProof rather than an estimate.
 *
 * DELIBERATELY NO BENCHMARK NUMBER
 *
 * This module never tells the merchant what rate they "should" pay. Real
 * clearing rates depend on card mix, ticket size, MCC, volume and contract
 * age, and no public table is accurate enough to quote at a specific
 * business. Naming a number we cannot stand behind would be inventing a
 * saving, which the product forbids outright. The letter instead asks the
 * acquirer to state the current rate in writing and to quote its best
 * available rate — a request that is always legitimate, never fabricated, and
 * which produces the real number from the only party that actually has it.
 */

export type MerchantFeeConcern =
  | "rate_too_high"
  | "terminal_rental"
  | "monthly_minimum"
  | "unexplained_charge"
  | "other";

export interface MerchantFeeInput {
  businessName: string;
  /** עוסק מורשה / ח.פ. — identifies the merchant account. */
  businessId?: string;
  /** Acquirer: ישראכרט / כאל / מקס / בנק, or free text. */
  acquirer: string;
  /** Merchant number as printed on the statement (מספר בית עסק). */
  merchantNumber?: string;
  concern: MerchantFeeConcern;
  /** What the merchant currently believes they pay, in their own words. */
  currentTerms?: string;
  /** Monthly card turnover in shekels — leverage, when the merchant knows it. */
  monthlyTurnoverShekels?: number;
  yearsAsCustomer?: string;
}

const CONCERN_HE: Record<MerchantFeeConcern, string> = {
  rate_too_high: "עמלת סליקה גבוהה ביחס לפעילות העסק",
  terminal_rental: "דמי שכירות/שירות עבור מסוף הסליקה",
  monthly_minimum: "עמלת מינימום חודשית",
  unexplained_charge: "חיוב שלא הוסבר בדף הפירוט",
  other: "תנאי הסליקה",
};

export function buildMerchantFeeLetter(input: MerchantFeeInput): {
  subject: string;
  body: string;
} {
  const business = input.businessName.trim() || "העסק";
  const acquirer = input.acquirer.trim() || "חברת הסליקה";
  const concern = CONCERN_HE[input.concern] || CONCERN_HE.other;

  const idLine = input.businessId?.trim()
    ? `\nח.פ. / עוסק מורשה: ${input.businessId.trim()}`
    : "";
  const merchantLine = input.merchantNumber?.trim()
    ? `\nמספר בית עסק: ${input.merchantNumber.trim()}`
    : "";
  const tenure = input.yearsAsCustomer?.trim()
    ? `\nותק כלקוח: ${input.yearsAsCustomer.trim()}`
    : "";

  // Turnover is leverage, but only when the merchant supplied it. Never
  // estimate it for them — a wrong number in a negotiation letter is worse
  // than no number.
  const turnover =
    input.monthlyTurnoverShekels && input.monthlyTurnoverShekels > 0
      ? `\nמחזור סליקה חודשי משוער: כ-₪${Math.round(input.monthlyTurnoverShekels).toLocaleString("he-IL")}`
      : "";

  const current = input.currentTerms?.trim()
    ? `\n\nהתנאים כפי שידועים לי כיום: ${input.currentTerms.trim()}`
    : "";

  return {
    subject: `בקשה לעדכון תנאי סליקה ולפירוט העמלות בכתב — ${business}`,
    body: `לכבוד מחלקת בתי עסק, ${acquirer},

שמי מטעם ${business}.${idLine}${merchantLine}${tenure}${turnover}

אני פונה בנושא ${concern}, ומבקש/ת שני דברים:

1. פירוט מלא בכתב של כל החיובים החלים על בית העסק כיום — שיעור עמלת הסליקה
   לפי סוג כרטיס (מקומי/חו״ל, דביט/אשראי), דמי מסוף, עמלת מינימום חודשית,
   וכל חיוב קבוע או משתנה נוסף.
2. הצעה מעודכנת לתנאים הטובים ביותר שאתם יכולים להציע לבית עסק בפרופיל
   הפעילות שלי.${current}

ככל שקיים פער בין התנאים שהוצגו לי בעת ההצטרפות לבין החיובים בפועל, אבקש
לתקן אותו ולהחזיר את ההפרש.

זו פנייה עסקית מקובלת. אני שוקל/ת את המשך ההתקשרות מול חלופות בשוק, ואשמח
להישאר לקוח/ה בתנאים תחרותיים.

אבקש מענה בכתב תוך 14 ימי עסקים.

בכבוד רב,
${business}`,
  };
}
