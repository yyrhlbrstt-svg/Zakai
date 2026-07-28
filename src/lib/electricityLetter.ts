/** Deterministic electricity supplier-switch request letters — no AI required. */

export interface ElectricityLetterInput {
  customerName: string;
  currentSupplier?: string;
  targetSupplier: string;
  planName?: string;
  monthlyBillShekels?: number;
  estimatedSavingShekels?: number;
  hasSmartMeter?: boolean;
  addressCity?: string;
}

export function buildElectricityLetter(input: ElectricityLetterInput): {
  subject: string;
  body: string;
} {
  const name = input.customerName.trim() || "הלקוח/ה";
  const target = input.targetSupplier.trim() || "ספק החשמל";
  const plan = input.planName?.trim() || "המסלול המוזל";
  const current = input.currentSupplier?.trim();
  const bill =
    input.monthlyBillShekels && input.monthlyBillShekels > 0
      ? `חשבונית חודשית משוערת כיום: ₪${Math.round(input.monthlyBillShekels)}.`
      : "";
  const saving =
    input.estimatedSavingShekels && input.estimatedSavingShekels > 0
      ? `הערכת חיסכון: כ-₪${Math.round(input.estimatedSavingShekels)} בחודש.`
      : "";
  const meter = input.hasSmartMeter
    ? "בבית מותקן מונה חכם."
    : "אין מונה חכם — מבקש/ת מסלול שטוח (flat) בלבד.";
  const city = input.addressCity?.trim() ? `יישוב: ${input.addressCity.trim()}.` : "";

  return {
    subject: `בקשת מעבר לספק חשמל — ${plan} | ${name}`,
    body: `לכבוד שירות הלקוחות, ${target},

שמי ${name}.
${city ? city + "\n" : ""}${current ? `ספק נוכחי (אם ידוע): ${current}.\n" : ""}${bill ? bill + "\n" : ""}${saving ? saving + "\n" : ""}${meter}

אני מבקש/ת להתחיל תהליך מעבר אליכם למסלול "${plan}" (או המסלול הקרוב ביותר הזמין בכתובת שלי), בהתאם לכללי ניוד ספקי החשמל בישראל.

מבקש/ת:
1. אישור בכתב על קבלת הבקשה ועל השלבים הבאים.
2. פירוט התעריף החודשי הצפוי והתנאים (הנחה, חלון שעות, תקופת התחייבות אם קיימת).
3. לוח זמנים משוער להשלמת הניוד מול "נגה" / חברת החשמל.

אין באמור בקשה לביצוע תשלום או שינוי פרטי חשבון בנק — רק מעבר ספק ובירור תעריף.

בברכה,
${name}
(המכתב נוסח בסיוע זכאי — סוכן דיגיטלי הפועל בהרשאת הלקוח/ה)`,
  };
}
