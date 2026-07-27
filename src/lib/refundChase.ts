export interface RefundInput {
  customerName: string;
  company: string;
  orderId?: string;
  amountShekels?: number;
  daysWaiting: number;
  product?: string;
}

export function buildRefundLetter(input: RefundInput): { subject: string; body: string } {
  const name = input.customerName.trim() || "הלקוח/ה";
  const company = input.company.trim() || "החברה";
  const order = input.orderId?.trim();
  const product = input.product?.trim();
  const amt = input.amountShekels && input.amountShekels > 0 ? `₪${Math.round(input.amountShekels)}` : null;
  const days = Math.max(0, Math.round(input.daysWaiting));

  return {
    subject: `דרישת החזר כספי — הזמנה ${order || ""}`.trim(),
    body: `לכבוד ${company},

שמי ${name}.
${order ? `מספר הזמנה: ${order}\n` : ""}${product ? `מוצר/שירות: ${product}\n` : ""}${amt ? `סכום להחזר: ${amt}\n` : ""}
חלפו כ-${days} ימים מאז שהובטח / התבקש החזר, והסכום טרם התקבל בחשבון.

מבקש/ת:
1. אישור בכתב על סטטוס ההחזר
2. ביצוע ההחזר תוך 5 ימי עסקים
3. אם יש עיכוב — סיבה ותאריך יעד

בברכה,\n${name}`,
  };
}
