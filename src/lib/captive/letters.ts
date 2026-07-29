/**
 * The letter that ends a captive price.
 *
 * WHY A LETTER AND NOT A LINK
 *
 * Naming the overpay is the easy half. The half that decides whether anybody
 * actually keeps the money is the sentence they have to write to a bank or an
 * insurer, and that is precisely where people stop: not because it is hard, but
 * because they do not know which clause to cite and are quietly afraid of being
 * told they cannot. Sending them off to a comparison site returns them to the
 * same blank page with a tab open.
 *
 * TWO LETTERS, BECAUSE THERE ARE TWO SITUATIONS
 *
 * Where a person can leave unilaterally, the letter is a notice: it states the
 * decision, cites the right, and gives a date. Where the incumbent has to
 * cooperate — a securities portfolio does not move without the bank — a notice
 * is a bluff, and a bluff that gets called teaches the person the product lied
 * to them. There the letter is a repricing demand with a credible alternative
 * attached, which is a smaller ask that actually works.
 *
 * Nothing here states a saving. The letter asks for the counterparty's number;
 * it does not tell them ours, because ours is a range about a market and theirs
 * is a fact about this person.
 */

import { type CaptiveProduct } from "./products";

export interface SwitchFields {
  name?: string;
  id?: string;
  /** Policy, account or member number — whatever identifies them to this counterparty. */
  reference?: string;
  /** What they pay now, in minor units per month. Optional: the letter works without it. */
  currentMonthlyMinor?: number;
}

export interface SwitchLetter {
  subject: string;
  body: string;
  /** "notice" when they can simply leave; "reprice" when the incumbent must act. */
  kind: "notice" | "reprice";
}

/** Hebrew product names, kept next to the letters that use them. */
const NAME_HE: Record<string, string> = {
  mortgage_life_insurance: "ביטוח חיים למשכנתא",
  mortgage_property_insurance: "ביטוח מבנה למשכנתא",
  pension_management_fees: "דמי ניהול בקרן הפנסיה",
  disability_rider: "כיסוי אובדן כושר עבודה",
  credit_card_fx_margin: "עמלת המרת מטבע בכרטיס האשראי",
  bank_securities_fees: "עמלות ניירות ערך",
  car_loan_insurance: "ביטוח שנמכר יחד עם הלוואת הרכב",
};

export function productNameHe(product: CaptiveProduct): string {
  return NAME_HE[product.id] ?? product.id;
}

function shekels(minor: number): string {
  return `₪${Math.round(minor / 100).toLocaleString("he-IL")}`;
}

function identityBlock(fields: SwitchFields): string {
  const lines = [
    fields.name ? `שם: ${fields.name}` : null,
    fields.id ? `ת״ז: ${fields.id}` : null,
    fields.reference ? `מספר פוליסה / חשבון: ${fields.reference}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Build the letter for one product.
 *
 * Missing fields are left as bracketed blanks rather than silently omitted. A
 * letter that reads correctly without a policy number will be sent without one
 * and bounce; a visible blank is a legible instruction to fill it in.
 */
export function buildSwitchLetter(product: CaptiveProduct, fields: SwitchFields = {}): SwitchLetter {
  const name = productNameHe(product);
  const identity = identityBlock(fields) || "שם: [שם מלא]\nת״ז: [מספר זהות]\nמספר פוליסה / חשבון: [מספר]";
  const paying = fields.currentMonthlyMinor
    ? `\nהחיוב החודשי הנוכחי בגין ${name} עומד על ${shekels(fields.currentMonthlyMinor)}.`
    : "";

  if (product.switchableWithoutIncumbent) {
    return {
      kind: "notice",
      subject: `הודעה על מעבר — ${name}`,
      body: [
        identity,
        "",
        `הנדון: ${name}`,
        "",
        `אני מודיע/ה בזאת על כוונתי להעביר את ${name} לגוף אחר.${paying}`,
        "",
        `זכות זו קבועה ב: ${product.rightToSwitch}.`,
        "",
        "אבקש ממכם, בתוך 14 ימי עסקים:",
        "1. פירוט מלא של התנאים והחיובים בפוליסה/בחשבון הקיים, כולל כל עמלה נלווית.",
        "2. אישור בכתב שאין מניעה חוזית או אחרת למעבר, או פירוט המניעה והבסיס לה.",
        "3. מועד סיום החיוב בפועל.",
        "",
        "ככל שקיימת אצלכם הצעה משופרת, אשמח לקבלה בכתב באותו מועד ולשקול אותה מול הצעות אחרות.",
        "",
        "בכבוד רב,",
        fields.name ?? "[שם מלא]",
      ].join("\n"),
    };
  }

  return {
    kind: "reprice",
    subject: `בקשה לעדכון תנאים — ${name}`,
    body: [
      identity,
      "",
      `הנדון: ${name}`,
      "",
      `אני פונה בבקשה לעדכון התנאים בגין ${name}.${paying}`,
      "",
      "בדקתי את התנאים המוצעים בשוק לגופים מקבילים ומצאתי פער משמעותי לרעתי.",
      "",
      "אבקש ממכם, בתוך 14 ימי עסקים:",
      "1. פירוט מלא של החיובים בפועל בשנה האחרונה.",
      "2. הצעת תנאים מעודכנת בכתב.",
      "3. פירוט העלויות והשלבים להעברת החשבון לגוף אחר, ככל שהתנאים לא יעודכנו.",
      "",
      `להסרת ספק, זכות המעבר קבועה ב: ${product.rightToSwitch}, ואני שוקל/ת אותה ברצינות.`,
      "",
      "בכבוד רב,",
      fields.name ?? "[שם מלא]",
    ].join("\n"),
  };
}
