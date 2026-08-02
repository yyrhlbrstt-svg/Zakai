/**
 * Outreach email subjects per vertical — the default telecom wording is wrong
 * for flights, deposits, and fines.
 */

export function outreachSubjectForVertical(
  vertical: string,
  principalName: string,
  authCode: string,
): string {
  const name = principalName.trim() || "הלקוח/ה";
  const code = authCode;
  switch (vertical) {
    case "airline":
      return `דרישת פיצוי טיסה בשם ${name} — הרשאה ${code}`;
    case "refund-chase":
      return `דרישת החזר כספי בשם ${name} — הרשאה ${code}`;
    case "deposit":
      return `דרישת השבת פיקדון בשם ${name} — הרשאה ${code}`;
    case "late-payment":
      return `דרישת תשלום חשבונית בשם ${name} — הרשאה ${code}`;
    case "parking":
    case "transport-fine":
      return `ערעור בכתב בשם ${name} — הרשאה ${code}`;
    case "bank-fees":
      return `בקשה לביטול/החזר עמלות בשם ${name} — הרשאה ${code}`;
    case "electricity":
      return `בקשת ניוד / התאמת תעריף חשמל בשם ${name} — הרשאה ${code}`;
  }
  return `בקשת התאמת מסלול בשם ${name} — הרשאה ${code}`;
}
