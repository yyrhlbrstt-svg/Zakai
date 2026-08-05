/**
 * Route 6 (כביש חוצה ישראל) toll-charge appeal — the same statutory appeals
 * committee this codebase's own IL rights catalog already cites
 * ("חקיקת כביש חוצה ישראל — ועדת ערר סטטוטורית", src/lib/global/packs/il.ts).
 */

export type TollDisputeReason =
  | "wrong_vehicle"
  | "vehicle_sold"
  | "duplicate"
  | "technical_fault"
  | "other";

export interface TollDisputeInput {
  customerName: string;
  invoiceNumber: string;
  reason: TollDisputeReason;
  details?: string;
  amountShekels?: number;
}

const REASON_TEXT: Record<TollDisputeReason, string> = {
  wrong_vehicle: "החיוב מתייחס לרכב שאינו שלי / שלא נהגתי בו במועד הנטען.",
  vehicle_sold: "הרכב נמכר לפני מועד הנסיעה הנטענת, ואינני הבעלים הרשום מאותו מועד.",
  duplicate: "חויבתי פעמיים עבור אותה נסיעה.",
  technical_fault: "יש חשד לתקלה טכנית בזיהוי הרכב או במערכת הגבייה.",
  other: "יש לי טענה נוספת שאינה מופיעה ברשימה.",
};

export function buildTollDisputeLetter(input: TollDisputeInput): { subject: string; body: string } {
  const name = input.customerName.trim() || "הלקוח/ה";
  const invoice = input.invoiceNumber.trim();
  const reasonText = REASON_TEXT[input.reason];
  const details = input.details?.trim();
  const amount =
    input.amountShekels && input.amountShekels > 0 ? `₪${Math.round(input.amountShekels)}` : null;

  return {
    subject: `ערעור על חיוב כביש 6${invoice ? ` — חשבונית ${invoice}` : ""}`,
    body: `לכבוד הוועדה הסטטוטורית,
כביש חוצה ישראל

שמי ${name}. אני מערער/ת על החיוב שבנדון${invoice ? ` (מספר חשבונית ${invoice})` : ""}${amount ? ` בסך ${amount}` : ""}.

${reasonText}${details ? `\n\nפירוט נוסף: ${details}` : ""}

בהתאם לחקיקת כביש חוצה ישראל, אבקש להעביר את הערעור לוועדת הערר הסטטוטורית ולבטל את החיוב. ככל שהערעור יידחה, אבקש נימוק מפורט בכתב ואת זכותי להמשיך בהליך הערר הקבוע בחוק.

בכבוד רב,
${name}`,
  };
}
