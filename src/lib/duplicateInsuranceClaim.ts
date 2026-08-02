/**
 * Duplicate indemnity health cover — written request to cancel redundant
 * private policies that overlap collective (work / שב"ן) cover. Deterministic
 * letter only; not insurance advice.
 */

import { POLICY_TYPES, type DuplicationResult } from "./insurance";
import { formatAgorot } from "./money";
import { withFooter } from "./letterFooter";

const POLICY_LABEL_HE: Record<string, string> = {
  surgery: "ביטוח ניתוחים",
  drugs: "ביטוח תרופות מחוץ לסל",
  transplant: "ביטוח השתלות",
  consultations: "ביטוח ייעוץ ובדיקות",
  criticalIllness: "ביטוח מחלות קשות",
  personalAccident: "ביטוח תאונות אישיות",
  life: "ביטוח חיים",
};

export interface DuplicateInsuranceLetterInput {
  customerName: string;
  insurerName: string;
  /** Wasteful overlap policy keys from computeDuplication. */
  wastefulPolicyKeys: string[];
  /** Documented monthly premium on the redundant lines (agorot). */
  monthlyPremiumAgorot: number;
}

export function wastefulPolicyKeysFromResult(result: DuplicationResult): string[] {
  return result.findings.filter((f) => f.wasteful).map((f) => f.key);
}

export function buildDuplicateInsuranceLetter(input: DuplicateInsuranceLetterInput): string {
  const name = input.customerName.trim() || "הלקוח/ה";
  const insurer = input.insurerName.trim() || "חברת הביטוח";
  const keys = input.wastefulPolicyKeys.filter((k) => POLICY_TYPES.some((p) => p.key === k));
  const lines =
    keys.length > 0
      ? keys.map((k) => `• ${POLICY_LABEL_HE[k] ?? k}`).join("\n")
      : "• כיסויי שיפוי כפולים שסומנו בבדיקת זכאי";

  const premium =
    input.monthlyPremiumAgorot > 0
      ? formatAgorot(input.monthlyPremiumAgorot, "he-IL")
      : "הפרמיה החודשית על הכיסויים המיותרים";

  const body = `לכבוד ${insurer}

שלום רב,

אני ${name}, מבוטח/ת בחברתכם. לפי בדיקה שביצעתי, יש לי כיסויי שיפוי (ולא פיצוי קבוע) שחופפים לכיסוי קולקטיבי שכבר קיים לי דרך מקום העבודה / קופת החולים (שב"ן). בביטוחי שיפוי ניתן לקבל החזר רק על העלות בפועל — ולכן פרמיה כפולה על אותו סוג כיסוי אינה ניתנת למימוש.

אבקש לבטל או להתאים את הכיסויים הפרטיים המיותרים הבאים, תוך שמירה על כיסויי פיצוי שלא נוגעים לבקשה זו:

${lines}

הפרמיה החודשית המשוערת על הכיסויים המיותרים: ${premium}.

אנא אשרו בכתב את ביטול/התאמת הפוליסה, את מועד סיום הכיסוי, ואת חיוב הפרמיה עד למועד זה. אם יש כיסוי ייחודי שאינו חופף לשב"ן — ציינו זאת בכתב לפני שינוי.

בברכה,
${name}`;

  return withFooter(body);
}
