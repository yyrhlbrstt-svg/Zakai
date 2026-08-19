/** Deterministic cancel / retention letters — Mandate agent voice, no AI required. */

import { agentLetterCloseHe, agentLetterOpenHe } from "@/lib/agentLetterVoice";
import { cancelTeethClauseHe } from "@/lib/legalTeeth";

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
  const amt =
    input.monthlyShekels && input.monthlyShekels > 0
      ? ` (כ-₪${Math.round(input.monthlyShekels)} לחודש)`
      : "";
  const reason = input.reason?.trim();
  const idLine = acct ? `\nמזהה חשבון / אימייל של הלקוח/ה: ${acct}` : "";
  const open = agentLetterOpenHe(name);
  const close = agentLetterCloseHe(name);

  if (input.intent === "retention") {
    return {
      subject: `בקשת התאמת מחיר / שימור — ${product}`,
      body: `לכבוד ${company},

${open}${idLine}

הלקוח/ה משלם/ת על ${product}${amt}. בשם הלקוח/ה אני מבקש הצעת שימור או התאמת מחיר בכתב — אחרת ייבחן ביטול.
${reason ? `\nפירוט: ${reason}\n` : ""}
בקשה אחת: מענה בכתב עם המחיר החדש ותנאי ההתחייבות אם יש.

${close}`,
    };
  }

  if (input.intent === "downgrade") {
    return {
      subject: `בקשה להורדת מסלול — ${product}`,
      body: `לכבוד ${company},

${open}${idLine}

בשם הלקוח/ה אני מבקש מעבר למסלול זול יותר עבור ${product}${amt}, בהתאם לשימוש בפועל.
${reason ? `\nסיבה: ${reason}\n` : ""}
בקשה אחת: אישור בכתב של המסלול החדש והמחיר החודשי.

${close}`,
    };
  }

  if (input.intent === "pause") {
    return {
      subject: `בקשה להקפאת מנוי — ${product}`,
      body: `לכבוד ${company},

${open}${idLine}

בשם הלקוח/ה אני מבקש להקפיא את המנוי ל-${product}${amt} החל מהמחזור הבא, ללא חיוב בתקופת ההקפאה.
${reason ? `\nסיבה: ${reason}\n` : ""}
בקשה אחת: אישור בכתב של ההקפאה.

${close}`,
    };
  }

  // Statutory cancellation is the one intent where the law itself has teeth:
  // the letter is framed as a 13ד cancellation notice AND as the written
  // demand 31א(ב) requires, so continued billing afterward walks straight
  // into the exemplary-damages exposure. Commercial asks above (retention /
  // downgrade / pause) deliberately carry no legal clause — citing
  // exemplary-damages law where it does not apply would be wrong and would
  // teach providers to discount it where it does.
  return {
    subject: `הודעת ביטול מנוי בכתב — ${product}`,
    body: `לכבוד ${company},

${open}${idLine}

בשם הלקוח/ה אני מודיע על ביטול המנוי/השירות: ${product}${amt}, ללא חיובים נוספים מעבר לתקופה שכבר שולמה.
${reason ? `\nסיבה: ${reason}\n` : ""}
${cancelTeethClauseHe()}

בקשה אחת: אישור בכתב של מועד הביטול והעדר חיובים עתידיים.

${close}`,
  };
}
