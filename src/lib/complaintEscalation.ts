/**
 * Complaint escalation — a consumer complaint sent to a company and ignored,
 * or answered unsatisfactorily, has a real next step: a regulator or public-
 * inquiries unit whose job is exactly this. Most people don't know one
 * exists, let alone which one, so the complaint just dies in an inbox.
 *
 * THE FACTS, VERIFIED (checked July 2026, via Bank of Israel / Ministry of
 * Communications / Kol-Zchut):
 *  - Banks and credit-card companies: the Bank of Israel's Banking
 *    Supervision Department runs a Public Inquiries and Consumer Supervision
 *    Unit (היחידה לפניות הציבור ולבקרה צרכנית) — escalate here once the bank
 *    itself hasn't resolved it, in particular after 45 days without a
 *    satisfactory reply (60 with a notified extension).
 *    https://www.boi.org.il/information/public-enquiries-unit/
 *  - Telecom (cellular, internet, landline, TV licensees): the Ministry of
 *    Communications runs a public-inquiries unit regulating all licensees.
 *    https://forms.moc.gov.il/f/PublicInquiries
 *  - General consumer complaints (misleading advertising, unauthorized
 *    charges, warranty/service, cancellation rights) not covered above: the
 *    Consumer Protection and Fair Trade Authority (הרשות להגנת הצרכן ולסחר
 *    הוגן) — this module points to gov.il rather than a specific phone
 *    number, since a wrong number handed to someone already frustrated is
 *    worse than a pointer to search for the current one.
 *
 * This module only ever names the real body and drafts the escalation letter
 * — it does not claim a resolution timeline or success rate, which nobody
 * can honestly promise for an individual complaint.
 */

export type ComplaintCategory = "bank" | "telecom" | "consumer";

export interface EscalationBody {
  category: ComplaintCategory;
  nameHe: string;
  nameEn: string;
  descriptionHe: string;
  descriptionEn: string;
  /** Only set when a specific, verified URL exists — never invented. */
  url?: string;
}

export const ESCALATION_BODIES: Record<ComplaintCategory, EscalationBody> = {
  bank: {
    category: "bank",
    nameHe: "הפיקוח על הבנקים — היחידה לפניות הציבור ולבקרה צרכנית (בנק ישראל)",
    nameEn: "Banking Supervision — Public Inquiries and Consumer Supervision Unit (Bank of Israel)",
    descriptionHe:
      "מטפלת בתלונות נגד בנקים וחברות כרטיסי אשראי, בפרט כאשר לא התקבל מענה מספק תוך 45 יום (60 יום אם ניתנה הודעה על הארכה).",
    descriptionEn:
      "Handles complaints against banks and credit-card companies, in particular when there's been no satisfactory reply within 45 days (60 with a notified extension).",
    url: "https://www.boi.org.il/information/public-enquiries-unit/",
  },
  telecom: {
    category: "telecom",
    nameHe: "משרד התקשורת — יחידת פניות הציבור",
    nameEn: "Ministry of Communications — Public Inquiries Unit",
    descriptionHe: "מטפלת בתלונות נגד בעלי רישיון בתחום התקשורת — סלולר, אינטרנט, טלפוניה, טלוויזיה.",
    descriptionEn: "Handles complaints against telecom licensees — cellular, internet, landline, TV.",
    url: "https://forms.moc.gov.il/f/PublicInquiries",
  },
  consumer: {
    category: "consumer",
    nameHe: "הרשות להגנת הצרכן ולסחר הוגן",
    nameEn: "Consumer Protection and Fair Trade Authority",
    descriptionHe:
      "מטפלת בתלונות צרכניות כלליות — הטעיה, חיוב ללא הרשאה, אחריות ושירות, ביטול עסקה — שאינן נכנסות לתחום בנקאות או תקשורת. פרטי הקשר המעודכנים נמצאים באתר gov.il.",
    descriptionEn:
      "Handles general consumer complaints — deception, unauthorized charges, warranty/service, cancellation rights — outside banking or telecom. Current contact details are on gov.il.",
  },
};

import { withFooter } from "./letterFooter";

export interface EscalationLetterInput {
  category: ComplaintCategory;
  name: string;
  company: string;
  originalComplaintSummary: string;
  originalComplaintDate?: string;
}

/** Compose the escalation letter body (Hebrew). Names the real body; invents no timeline or outcome. */
export function buildEscalationLetter(input: EscalationLetterInput): string {
  const { category, name, company, originalComplaintSummary, originalComplaintDate } = input;
  const body = ESCALATION_BODIES[category];
  const dateLine = originalComplaintDate ? ` בתאריך ${originalComplaintDate}` : "";

  return withFooter(
    [
      `לכבוד ${body.nameHe},`,
      "",
      `שמי ${name}. פניתי ל-${company}${dateLine} בתלונה שלא זכתה למענה מספק עד היום.`,
      "",
      `תמצית התלונה: ${originalComplaintSummary}`,
      "",
      "מאחר שהפנייה הישירה לחברה לא הביאה לפתרון, אני מבקש/ת את התערבותכם בהתאם לסמכותכם, ולקבל עדכון על הטיפול בפנייה.",
      "",
      "מצ\"ב פרטי הפנייה המקורית לחברה, זמינים לפי בקשה.",
      "",
      "בכבוד רב,",
      name,
    ].join("\n"),
  );
}
