/**
 * The notification that stops the clock.
 *
 * WHAT THESE LETTERS ARE AND ARE NOT
 *
 * They are not claims and do not pretend to be. A claim against National
 * Insurance runs on a statutory form, a claim against an insurer needs medical
 * documentation nobody has assembled yet, and a product that told somebody
 * "we filed for you" when it drafted a paragraph would be lying about the one
 * thing that matters.
 *
 * What they are is the notification, which is a smaller act with most of the
 * value. Notifying an insurer of an event in writing, dated, is what preserves
 * the position while the medical picture is still forming — and it is the step
 * people skip, because they are waiting to know how bad it is before they
 * "bother anyone". By the time they know, the twelve-month window is half gone.
 *
 * So each letter states the event, asks the payer to open a file and to
 * disclose the cover, and asks for their forms. It claims nothing about the
 * outcome, because nothing about the outcome is knowable yet.
 */

import { type CoverSource } from "./sources";

export interface IncidentLetterFields {
  name?: string;
  id?: string;
  /** Free-text description of what happened, in the person's own words. */
  what?: string;
  occurredAt?: Date;
  /** Employer, club, insurer or fund name, depending on the payer. */
  counterparty?: string;
}

export interface IncidentLetter {
  subject: string;
  body: string;
}

const PAYER_HE: Record<CoverSource["payer"], string> = {
  national_insurance: "לכבוד\nהמוסד לביטוח לאומי — סניף מקום המגורים",
  insurer: "לכבוד\n{counterparty} — מחלקת תביעות",
  pension_fund: "לכבוד\n{counterparty} — מחלקת תביעות ואובדן כושר עבודה",
  hmo: "לכבוד\n{counterparty} — מחלקת שירותים נוספים (שב״ן)",
  local_authority: "לכבוד\n{counterparty} — מחלקת החינוך, ביטוח תאונות אישיות לתלמידים",
  sports_association: "לכבוד\n{counterparty} — מזכירות האגודה",
  defence_ministry: "לכבוד\nמשרד הביטחון — אגף שיקום נכים",
};

function hebrewDate(d?: Date): string {
  if (!d) return "[תאריך האירוע]";
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

export function buildIncidentLetter(
  source: CoverSource,
  fields: IncidentLetterFields = {},
): IncidentLetter {
  const to = PAYER_HE[source.payer].replace(
    "{counterparty}",
    fields.counterparty ?? "[שם הגוף]",
  );
  const name = fields.name ?? "[שם מלא]";
  const id = fields.id ?? "[מספר זהות]";
  const when = hebrewDate(fields.occurredAt);
  const what = fields.what ?? "[תיאור קצר של האירוע והפגיעה]";

  return {
    subject: `הודעה על אירוע ובקשה לפתיחת תיק — ${when}`,
    body: [
      to,
      "",
      `שם: ${name}`,
      `ת״ז: ${id}`,
      "",
      `הנדון: הודעה על אירוע מיום ${when} ובקשה לפתיחת תיק`,
      "",
      `אני מודיע/ה בזאת על אירוע שהתרחש ביום ${when}:`,
      what,
      "",
      "הודעה זו נמסרת בסמוך למועד האפשרי ואינה ממצה את הנזק, אשר טרם התגבש.",
      "",
      "אבקש מכם, בתוך 14 ימי עסקים:",
      "1. לפתוח תיק בגין האירוע ולמסור לי את מספרו.",
      "2. למסור פירוט מלא בכתב של הכיסויים החלים עליי אצלכם במועד האירוע, לרבות תנאיהם וסייגיהם.",
      "3. למסור את הטפסים והמסמכים הדרושים להגשת תביעה.",
      "4. לפרט את המועד האחרון להגשת תביעה בגין אירוע זה, לפי עמדתכם.",
      "",
      `הבסיס לפנייה: ${source.statute}.`,
      "",
      "אין באמור כדי לוותר על טענה כלשהי, ואין בו כדי למצות זכויות כלפי גורמים נוספים.",
      "",
      "בכבוד רב,",
      name,
    ].join("\n"),
  };
}
