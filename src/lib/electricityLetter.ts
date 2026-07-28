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

  const lines = [
    `לכבוד שירות הלקוחות, ${target}`,
    "",
    `שמי ${name}.`,
  ];
  if (city) lines.push(city);
  if (current) lines.push(`ספק נוכחי (אם ידוע): ${current}.`);
  if (bill) lines.push(bill);
  if (saving) lines.push(saving);
  lines.push(meter);
  lines.push("");
  lines.push(
    `אני מבקש/ת להתחיל תהליך מעבר אליכם למסלול "${plan}" (או המסלול הקרוב ביותר הזמין בכתובת שלי), בהתאם לכללי ניוד ספקי החשמל בישראל.`,
  );
  lines.push("");
  lines.push("מבקש/ת:");
  lines.push("1. אישור בכתב על קבלת הבקשה ועל השלבים הבאים.");
  lines.push("2. פירוט התעריף החודשי הצפוי והתנאים (הנחה, חלון שעות, תקופת התחייבות אם קיימת).");
  lines.push('3. לוח זמנים משוער להשלמת הניוד מול "נגה" / חברת החשמל.');
  lines.push("");
  lines.push(
    "אין באמור בקשה לביצוע תשלום או שינוי פרטי חשבון בנק — רק מעבר ספק ובירור תעריף.",
  );
  lines.push("");
  lines.push("בברכה,");
  lines.push(name);
  lines.push("(המכתב נוסח בסיוע זכאי — סוכן דיגיטלי הפועל בהרשאת הלקוח/ה)");

  return {
    subject: `בקשת מעבר לספק חשמל — ${plan} | ${name}`,
    body: lines.join("\n"),
  };
}
