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
 *    הוגן), whose official gov.il complaint form was verified August 2026.
 *
 * Since August 2026 the identities and intake URLs live in the recipient
 * directory (rightsGraph/directory.ts) with per-entry lastVerifiedAt dates;
 * this module derives from it and keeps only the escalation copy and letter.
 *
 * This module only ever names the real body and drafts the escalation letter
 * — it does not claim a resolution timeline or success rate, which nobody
 * can honestly promise for an individual complaint.
 */

import { getRegulator } from "@/lib/rightsGraph/directory";

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

/**
 * Body identity and intake URL come from the recipient directory
 * (rightsGraph/directory.ts), which carries the verification date — this file
 * keeps only the UI copy. Two files each holding their own copy of a
 * regulator's name is how one of them quietly goes stale.
 */
const CATEGORY_REF: Record<ComplaintCategory, string> = {
  bank: "regulator:boi-banking-supervision",
  telecom: "regulator:moc-public-inquiries",
  consumer: "regulator:consumer-protection-authority",
};

function bodyFromDirectory(
  category: ComplaintCategory,
  descriptionHe: string,
  descriptionEn: string,
): EscalationBody {
  const entry = getRegulator(CATEGORY_REF[category]);
  if (!entry) throw new Error(`escalation category "${category}" has no directory entry`);
  return {
    category,
    nameHe: entry.legalName.he,
    nameEn: entry.legalName.en,
    descriptionHe,
    descriptionEn,
    url: entry.demand?.channel === "web_form" ? entry.demand.url : entry.sourceUrl,
  };
}

export const ESCALATION_BODIES: Record<ComplaintCategory, EscalationBody> = {
  bank: bodyFromDirectory(
    "bank",
    "מטפלת בתלונות נגד בנקים וחברות כרטיסי אשראי, בפרט כאשר לא התקבל מענה מספק תוך 45 יום (60 יום אם ניתנה הודעה על הארכה).",
    "Handles complaints against banks and credit-card companies, in particular when there's been no satisfactory reply within 45 days (60 with a notified extension).",
  ),
  telecom: bodyFromDirectory(
    "telecom",
    "מטפלת בתלונות נגד בעלי רישיון בתחום התקשורת — סלולר, אינטרנט, טלפוניה, טלוויזיה.",
    "Handles complaints against telecom licensees — cellular, internet, landline, TV.",
  ),
  consumer: bodyFromDirectory(
    "consumer",
    "מטפלת בתלונות צרכניות כלליות — הטעיה, חיוב ללא הרשאה, אחריות ושירות, ביטול עסקה — שאינן נכנסות לתחום בנקאות או תקשורת.",
    "Handles general consumer complaints — deception, unauthorized charges, warranty/service, cancellation rights — outside banking or telecom.",
  ),
};

/**
 * Case.vertical → the regulator this tool should point at. Only bank and
 * telecom have a dedicated public-inquiries unit in ESCALATION_BODIES above;
 * every other vertical (subscriptions, parking, insurance, electricity,
 * warranty, arnona…) falls through to the general Consumer Protection and
 * Fair Trade Authority, which is correct, not a fallback of convenience —
 * that body's real mandate covers exactly these categories.
 */
const BANK_VERTICALS = new Set(["bank-fees", "deposit", "late-payment", "refund-chase"]);
const TELECOM_VERTICALS = new Set(["telecom"]);

export function complaintCategoryForVertical(vertical?: string | null): ComplaintCategory {
  if (vertical && TELECOM_VERTICALS.has(vertical)) return "telecom";
  if (vertical && BANK_VERTICALS.has(vertical)) return "bank";
  return "consumer";
}

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
