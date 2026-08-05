/**
 * Concealed-leak water-bill credit request — Water & Sewage Corporations
 * Tariff Rules, 5770-2009 (כללי תאגידי מים וביוב (תעריפים לשירותי מים וביוב),
 * התש"ע-2009 — הנחה בגין נזילה סמויה), the same citation already registered
 * in this codebase's IL rights catalog (src/lib/global/packs/il.ts). The
 * rule conditions the credit on proof the leak was repaired, so the letter
 * states that proof is attached/available rather than promising the
 * corporation will accept it, and never invents a credit amount or a
 * guaranteed outcome.
 */

export interface WaterBillCreditInput {
  customerName: string;
  accountNumber: string;
  repairDate: string;
  billAmountShekels?: number;
  hasRepairProof: boolean;
}

export function buildWaterBillCreditLetter(
  input: WaterBillCreditInput,
): { subject: string; body: string } {
  const name = input.customerName.trim() || "הלקוח/ה";
  const account = input.accountNumber.trim();
  const date = input.repairDate.trim();
  const bill =
    input.billAmountShekels && input.billAmountShekels > 0
      ? `₪${input.billAmountShekels.toFixed(2)}`
      : null;
  const proofLine = input.hasRepairProof
    ? "אישור תיקון הנזילה מאת איש מקצוע מוסמך מצורף/יועבר לפי דרישה."
    : "אני פועל/ת להשגת אישור תיקון מאת איש מקצוע מוסמך, ואעביר אותו בהקדם.";

  return {
    subject: `בקשה להנחה בגין נזילה סמויה — צרכן ${account || name}`,
    body: `לכבוד תאגיד המים והביוב,

שמי ${name}${account ? `, מספר צרכן ${account}` : ""}.

חשבון המים שהתקבל אצלי חורג משמעותית מהצריכה הרגילה, בעקבות נזילה סמויה שאותרה ותוקנה. תאריך התיקון: ${date}.
${bill ? `סכום החשבון החריג: ${bill}\n` : ""}
${proofLine}

בהתאם לכללי תאגידי המים והביוב (תעריפים לשירותי מים וביוב), התש"ע-2009, המאפשרים הנחה בגין נזילה סמויה שתוקנה, אבקש:
1. בחינת הבקשה להנחה בגין הנזילה הסמויה
2. פירוט החישוב וההנחה שתאושר, ככל שתאושר
3. אם הבקשה נדחית — נימוק מפורט בכתב

בכבוד רב,
${name}`,
  };
}
