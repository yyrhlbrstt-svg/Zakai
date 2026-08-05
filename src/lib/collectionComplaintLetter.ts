/**
 * Debt-collection fairness demand — Consumer Protection Law, 5741-1981 and
 * Capital Market Authority debt-collection guidelines (חוק הגנת הצרכן,
 * התשמ"א-1981; הנחיות רשות שוק ההון — גביית חובות), the same citation
 * already registered in this codebase's IL rights catalog
 * (src/lib/global/packs/il.ts). This is a fairness/transparency demand, not
 * a refund claim — the letter never promises the debt will be cancelled or
 * reduced, only that the collector must prove it in writing and stop
 * harassment while that proof is pending.
 */

export type CollectionComplaintReason =
  | "harassment"
  | "no_written_notice"
  | "disputed_amount"
  | "other";

const REASON_TEXT: Record<CollectionComplaintReason, string> = {
  harassment: "אני מקבל/ת שיחות וטלפונים חוזרים ותכופים בניגוד להנחיות הוגנות לגביית חוב.",
  no_written_notice: "מעולם לא קיבלתי הודעה בכתב המפרטת את מקור החוב, סכומו והרכבו.",
  disputed_amount: "אני חולק/ת על סכום החוב הנטען ומבקש/ת פירוט מלא ואסמכתאות.",
  other: "יש לי טענה לגבי אופן גביית החוב שמצריכה בירור ומענה בכתב.",
};

export interface CollectionComplaintInput {
  customerName: string;
  collectorName: string;
  reason: CollectionComplaintReason;
  claimedAmountShekels?: number;
}

export function buildCollectionComplaintLetter(
  input: CollectionComplaintInput,
): { subject: string; body: string } {
  const name = input.customerName.trim() || "הלקוח/ה";
  const collector = input.collectorName.trim() || "חברת הגבייה";
  const reasonText = REASON_TEXT[input.reason];
  const claimed =
    input.claimedAmountShekels && input.claimedAmountShekels > 0
      ? `הסכום הנטען על ידכם: ₪${input.claimedAmountShekels.toFixed(2)}.\n`
      : "";

  return {
    subject: `דרישה לאימות חוב בכתב והפסקת הטרדה — ${name}`,
    body: `לכבוד ${collector},

שמי ${name}.

${reasonText}
${claimed}
בהתאם לחוק הגנת הצרכן, התשמ"א-1981 ולהנחיות רשות שוק ההון בעניין גביית חובות, אבקש:
1. אימות החוב בכתב — מקור, סכום מלא ואסמכתאות
2. הפסקת פניות טלפוניות חוזרות עד קבלת האימות בכתב
3. אין לבצע כל פעולת גבייה נוספת עד מענה בכתב לבקשה זו

למען הסר ספק — פנייה זו אינה הודאה בחוב ואינה ויתור על כל טענה.

בכבוד רב,
${name}`,
  };
}
