/** Deterministic cancel / retention letters — no AI required. */

export type CancelIntent = "cancel" | "pause" | "downgrade" | "retention";

export interface CancelInput {
  customerName: string;
  company: string;
  product: string;
  accountOrEmail?: string;
  monthlyShekels?: number;
  intent: CancelIntent;
  reason?: string;
}

export function buildCancelLetter(input: CancelInput): { subject: string; body: string } {
  const name = input.customerName.trim() || "הלקוח/ה";
  const company = input.company.trim() || "החברה";
  const product = input.product.trim() || "השירות";
  const acct = input.accountOrEmail?.trim();
  const amt = input.monthlyShekels && input.monthlyShekels > 0 ? ` (כ-₪${Math.round(input.monthlyShekels)} לחודש)` : "";
  const reason = input.reason?.trim();
  const idLine = acct ? `\nמזהה חשבון / אימייל: ${acct}` : "";

  if (input.intent === "retention") {
    return {
      subject: `בקשת התאמת מחיר / שימור — ${product}`,
      body: `לכבוד ${company},

שמי ${name}.${idLine}

אני לקוח/ה משלם/ת על ${product}${amt}. מבקש/ת הצעת שימור או התאמת מחיר בכתב — אחרת אשקול ביטול.
${reason ? `\nפירוט: ${reason}\n` : ""}
נא מענה בכתב עם המחיר החדש ותנאי ההתחייבות אם יש.

בברכה,\n${name}`,
    };
  }

  if (input.intent === "downgrade") {
    return {
      subject: `בקשה להורדת מסלול — ${product}`,
      body: `לכבוד ${company},

שמי ${name}.${idLine}

מבקש/ת לעבור למסלול זול יותר עבור ${product}${amt}, בהתאם לשימוש בפועל.
${reason ? `\nסיבה: ${reason}\n` : ""}
נא לאשר בכתב את המסלול החדש ואת המחיר החודשי.

בברכה,\n${name}`,
    };
  }

  if (input.intent === "pause") {
    return {
      subject: `בקשה להקפאת מנוי — ${product}`,
      body: `לכבוד ${company},

שמי ${name}.${idLine}

מבקש/ת להקפיא את המנוי ל-${product}${amt} החל מהמחזור הבא, ללא חיוב בתקופת ההקפאה.
${reason ? `\nסיבה: ${reason}\n` : ""}
נא לאשר בכתב.

בברכה,\n${name}`,
    };
  }

  return {
    subject: `בקשת ביטול מנוי — ${product}`,
    body: `לכבוד ${company},

שמי ${name}.${idLine}

מבקש/ת לבטל לאלתר את המנוי/השירות: ${product}${amt}, ללא חיובים נוספים מעבר לתקופה שכבר שולמה.
${reason ? `\nסיבה: ${reason}\n` : ""}
נא לאשר בכתב את מועד הביטול ואת העדר חיובים עתידיים.

בברכה,\n${name}`,
  };
}
