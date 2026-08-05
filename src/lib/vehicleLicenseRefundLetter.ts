/**
 * Pro-rated vehicle-license-fee refund demand — Traffic Regulations
 * (תקנות התעבורה — החזר יחסי על אגרת רישוי בעת ביטול רישוי או אבדן גמור),
 * the same citation already registered in this codebase's IL rights catalog
 * (src/lib/global/packs/il.ts). Only applies to license cancellation or
 * total loss — NOT a regular sale to a third party, which the letter states
 * explicitly so it can't be misused for an ineligible claim.
 */

export type VehicleLicenseRefundReason = "cancelled" | "total_loss";

export interface VehicleLicenseRefundInput {
  customerName: string;
  licensePlate: string;
  reason: VehicleLicenseRefundReason;
  cancellationDate: string;
  annualFeeShekels?: number;
}

export function buildVehicleLicenseRefundLetter(
  input: VehicleLicenseRefundInput,
): { subject: string; body: string } {
  const name = input.customerName.trim() || "הלקוח/ה";
  const plate = input.licensePlate.trim();
  const date = input.cancellationDate.trim();
  const reasonText =
    input.reason === "total_loss"
      ? "הרכב הוכרז אבדן גמור (טוטאל לוס)."
      : "בוטל רישוי הרכב והוא הוצא משימוש בכביש.";
  const fee =
    input.annualFeeShekels && input.annualFeeShekels > 0
      ? `₪${input.annualFeeShekels.toFixed(2)}`
      : null;

  return {
    subject: `בקשה להחזר יחסי — אגרת רישוי רכב${plate ? ` ${plate}` : ""}`,
    body: `לכבוד אגף הרישוי,
משרד התחבורה

שמי ${name}, בעל/ת הרכב${plate ? ` מספר ${plate}` : ""}.

${reasonText} מועד: ${date}.
${fee ? `אגרת הרישוי השנתית ששולמה: ${fee}\n` : ""}
בהתאם לתקנות התעבורה, זכאי בעל רכב להחזר יחסי של אגרת הרישוי בגין התקופה שלאחר ביטול הרישוי או האבדן הגמור — זכות שאינה חלה על מכירה רגילה של הרכב לצד שלישי, ואיני מבקש/ת החזר על בסיס מכירה.

אבקש:
1. אישור בכתב על קליטת הבקשה
2. חישוב ההחזר היחסי המגיע וביצועו
3. אם הבקשה נדחית — נימוק מפורט בכתב

בכבוד רב,
${name}`,
  };
}
