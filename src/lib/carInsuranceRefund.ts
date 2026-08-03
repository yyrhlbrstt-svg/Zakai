/** Deterministic letter for IL car insurance pro-rata premium refund. */

export interface CarInsuranceRefundInput {
  customerName: string;
  insurer: string;
  policyNumber?: string;
  vehicle?: string;
  cancelReason?: string;
  premiumPaidShekels?: number;
  unusedMonths?: number;
}

export function buildCarInsuranceRefundLetter(input: CarInsuranceRefundInput): {
  subject: string;
  body: string;
} {
  const name = input.customerName.trim() || "הלקוח/ה";
  const insurer = input.insurer.trim() || "המבטח";
  const policy = input.policyNumber?.trim() || "כמפורט בתיק";
  const vehicle = input.vehicle?.trim();
  const reason = input.cancelReason?.trim() || "ביטול פוליסה באמצע תקופה";
  const paid =
    input.premiumPaidShekels && input.premiumPaidShekels > 0
      ? ` הפרמיה ששולמה לתקופה הרלוונטית כ-₪${Math.round(input.premiumPaidShekels)}.`
      : "";
  const unused =
    input.unusedMonths && input.unusedMonths > 0
      ? ` תקופה שלא נוצלה משוערת: כ-${Math.round(input.unusedMonths)} חודשים.`
      : "";

  return {
    subject: `ביטול פוליסת ביטוח רכב — החזר פרמיה יחסי | ${name}`,
    body: `לכבוד שירות הלקוחות של ${insurer},

אני, ${name}, מבוטח/ת מספר פוליסה ${policy}${vehicle ? ` (רכב: ${vehicle})` : ""}.

אני מודיע/ה על ביטול פוליסת ביטוח הרכב:${reason ? ` ${reason}.` : ""}${paid}${unused}

לפי חוק חוזי הביטוח, התשמ״א-1981, אבקש לסלק את הפוליסה ולהשיב את יתרת הפרמיה ששולמה בגין תקופה שלא נוצלה, בתוך המועד הקבוע בחוק.

אבקש אישור בכתב על:
1. מועד סיום הכיסוי.
2. סכום ההחזר / הזיכוי ואמצעי התשלום.
3. פירוט חישוב ההחזר היחסי.

פנייה זו נשלחת באמצעות זכאי — סוכן דיגיטלי מורשה מטעמי. מצורף/קיים מסמך הרשאה לאימות.

בברכה,
${name}
באמצעות זכאי`,
  };
}
