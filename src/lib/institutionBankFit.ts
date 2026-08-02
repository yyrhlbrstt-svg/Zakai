/**
 * Hypothesis-only institution fit — NOT customers, NOT pipeline claims.
 * Used on /institutions for inbound teams to self-segment.
 */

export type FitTier = "high" | "medium" | "exploratory";
export type InstitutionKind = "bank" | "card" | "fintech";

export interface InstitutionFitHypothesis {
  id: string;
  nameHe: string;
  nameEn: string;
  kind: InstitutionKind;
  tier: FitTier;
  whyHe: string;
  whyEn: string;
}

/** Israel-focused; expand when packs prove other markets. */
export const INSTITUTION_FIT_HYPOTHESES: readonly InstitutionFitHypothesis[] = [
  {
    id: "one-zero",
    nameHe: "וואן זירו",
    nameEn: "One Zero",
    kind: "bank",
    tier: "high",
    whyHe: "בנק דיגיטלי — embed לחיסכון/עמלות בלי לבנות סוכן צרכן פנימי; אימות Mandate לפניות נכנסות.",
    whyEn: "Digital bank — embed for savings/fee paths without building an in-house consumer agent; Mandate verify on inbound mail.",
  },
  {
    id: "pepper",
    nameHe: "פפר / לאומי דיגיטל",
    nameEn: "Pepper (Leumi digital)",
    kind: "bank",
    tier: "high",
    whyHe: "קהל צעיר, עמלות ומנויים — ערוץ B2B2C עם partnerRef מדיד.",
    whyEn: "Younger base, fees and subs — measurable B2B2C channel via embed + partnerRef.",
  },
  {
    id: "leumi",
    nameHe: "בנק לאומי",
    nameEn: "Bank Leumi",
    kind: "bank",
    tier: "medium",
    whyHe: "נפח פניות צרכן — צוות הונאה/שירות יכול לאמת הרשאה ב-JWKS בלי שיחת מכירה.",
    whyEn: "High consumer inquiry volume — fraud/service can verify authority via JWKS without a sales integration.",
  },
  {
    id: "hapoalim",
    nameHe: "בנק הפועלים",
    nameEn: "Bank Hapoalim",
    kind: "bank",
    tier: "medium",
    whyHe: "דומה ללאומי — ערך באימות נכנס + הפחתת שיחות על «סוכן בשם הלקוח».",
    whyEn: "Similar to Leumi — value in inbound verify + fewer ambiguous «agent acting for customer» cases.",
  },
  {
    id: "discount",
    nameHe: "בנק דיסקונט / מרכנתיל",
    nameEn: "Discount / Mercantile",
    kind: "bank",
    tier: "medium",
    whyHe: "שירות דיגיטלי מתקדם — פיילוט verify לפני כל embed רחב.",
    whyEn: "Strong digital service — verify pilot before any wide embed.",
  },
  {
    id: "mizrahi",
    nameHe: "מזרחי טפחות",
    nameEn: "Mizrahi-Tefahot",
    kind: "bank",
    tier: "medium",
    whyHe: "בנק קמעונאי גדול — אותה תבנית אימות כמו שאר הגדולים.",
    whyEn: "Large retail bank — same verify pattern as other incumbents.",
  },
  {
    id: "cal",
    nameHe: "כאל",
    nameEn: "CAL",
    kind: "card",
    tier: "medium",
    whyHe: "לא בנק מלא — מתאים לערעורי עמלות/חיובים כשהפנייה בכתב עם Mandate.",
    whyEn: "Card issuer — fits fee/charge disputes when contact is written with a verifiable Mandate.",
  },
  {
    id: "isracard",
    nameHe: "ישראכרט",
    nameEn: "Isracard",
    kind: "card",
    tier: "medium",
    whyHe: "כמו כאל — אימות הרשאה לפני טיפול בבקשת צרכן.",
    whyEn: "Like CAL — authority verification before handling consumer requests.",
  },
  {
    id: "first",
    nameHe: "הבינלאומי הראשון",
    nameEn: "First International",
    kind: "bank",
    tier: "exploratory",
    whyHe: "קטן יותר — ניסוי טכני אפשרי אם יש inbound מצד חדשנות.",
    whyEn: "Smaller — technical pilot possible if innovation team reaches inbound.",
  },
];
