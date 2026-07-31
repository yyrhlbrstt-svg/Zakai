/**
 * Parental payments in the Israeli education system (תשלומי הורים) — a
 * kindergarten or school asking for money is treated by most parents as
 * automatically due, when the Ministry of Education's own circular draws a
 * sharp, citable line between what's actually mandatory and what isn't.
 *
 * THE FACTS, VERIFIED (checked July 2026, via the Ministry of Education's
 * annual Parental Payments Circular and Kol-Zchut):
 *  - Only one payment is mandatory (תשלום חובה): personal accident insurance
 *    for the student (ביטוח תאונות אישיות). Its cap is set fresh in each
 *    year's circular — for the 2025–2026 school year (תשפ"ו) it was ₪69 per
 *    student — so this module treats that figure as informational for the
 *    year it was checked, never as a constant to carry forward silently.
 *  - Everything else a school or kindergarten bills — class parties,
 *    photographs, enrichment activities, trips, textbook rental — is a
 *    voluntary payment (תשלום רשות): it requires the parent's actual
 *    consent, and a student's participation in the regular educational
 *    program can never be made conditional on paying it.
 *  - If a paid-for service isn't actually provided, the money must be
 *    refunded in full. Any year-end surplus in a voluntary-payment fund
 *    must be credited back to the parents who paid into it.
 *  - An institution's own payment plan (חוזר תשלומים מוסדי) needs prior
 *    approval from the district inspector before any money is collected
 *    under it.
 *  https://apps.education.gov.il/mankal/Hodaa.aspx?siduri=357
 *  https://www.kolzchut.org.il/he/זכותון_תשלומי_הורים_במערכת_החינוך
 *
 * This module never guesses whether a specific charge is "the mandatory
 * one" — only the parent knows what they were actually billed for. It
 * states the real distinguishing rule and drafts the letter; the parent
 * supplies what they were charged and why.
 */

import { withFooter } from "./letterFooter";

export const MANDATORY_PAYMENT_CATEGORY_HE = "ביטוח תאונות אישיות";
export const MANDATORY_PAYMENT_CIRCULAR_URL = "https://apps.education.gov.il/mankal/Hodaa.aspx?siduri=357";

export type ParentPaymentCategory = "accident_insurance" | "other";

/** Only accident insurance is ever mandatory — everything else is a voluntary payment by definition. */
export function isMandatoryPayment(category: ParentPaymentCategory): boolean {
  return category === "accident_insurance";
}

export interface ParentPaymentLetterInput {
  parentName: string;
  studentName: string;
  institutionName: string;
  chargeDescription: string;
  chargeAmountShekels: number;
  reason: string;
}

/** Compose a letter to the institution, citing the real voluntary-payment rule. Never claims a specific outcome. */
export function buildParentPaymentLetter(input: ParentPaymentLetterInput): string {
  const { parentName, studentName, institutionName, chargeDescription, chargeAmountShekels, reason } = input;

  return withFooter(
    [
      `לכבוד הנהלת ${institutionName},`,
      "",
      `שמי ${parentName}, הורה של ${studentName}.`,
      "",
      `חויבתי בתשלום על סך ${chargeAmountShekels} ש"ח עבור: ${chargeDescription}.`,
      "",
      "בהתאם לחוזר תשלומי ההורים של משרד החינוך, התשלום המחייב היחיד במערכת החינוך הוא ביטוח תאונות אישיות. כל תשלום אחר הוא תשלום רשות, המחייב הסכמה מדעת של ההורה, ואינו יכול להוות תנאי להשתתפות התלמיד/ה בתכנית הלימודים הרגילה.",
      "",
      reason,
      "",
      "לאור זאת אני מבקש/ת החזר מלא של הסכום ששולם, או הבהרה מפורטת מדוע מדובר בתשלום חובה החורג מהכלל האמור.",
      "",
      "בכבוד רב,",
      parentName,
    ].join("\n"),
  );
}
