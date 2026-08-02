/**
 * The Action Engine — the layer that turns "you are entitled to X" into
 * "here is the finished document, sent from inside Zakai".
 *
 * The single biggest hole in the product until now: the rights engine found
 * 60 entitlements and then ended every one of them with "go to the tax
 * authority's site / go to Har HaKesef / go to your municipality". That is the
 * moment the customer leaves and never comes back. Discovery without
 * fulfilment is not a product.
 *
 * So: every entitlement in `rights.ts` has exactly one entry here, and none of
 * them is an external link. An action is one of three kinds:
 *
 *   - `tool`   — Zakai already has an in-app tool that does this end to end
 *                (bill check, electricity, flights, payslip, ...). We route
 *                internally, never out.
 *   - `letter` — Zakai drafts the finished application/demand in-app from a
 *                handful of fields, ready to send, print or hand to the agent.
 *   - `agent`  — the case pipeline (authorisation → ownership proof →
 *                outreach → settlement) runs it on the customer's behalf.
 *
 * Two deliberate design decisions worth keeping when this goes global:
 *
 *  1. **UI language ≠ document language.** An Arabic- or Russian-speaking user
 *     in Israel reads the app in their own language, but the letter that
 *     leaves the building has to be in the language the receiving authority
 *     actually processes — Hebrew here. `docLocale` on the market makes that
 *     explicit instead of accidental, and is what lets a second country drop
 *     in as data rather than a rewrite.
 *  2. **No `how-to` prose.** The old copy explained how to do it yourself.
 *     Copy that explains a manual process is a confession that the product
 *     does not do it. Every string here describes what Zakai does.
 */

export type ActionKind = "tool" | "letter" | "agent";

/** Who the finished document is addressed to. */
export type Recipient =
  | "tax_authority"
  | "national_insurance"
  | "municipality"
  | "bank"
  | "provider"
  | "employer"
  | "health_fund"
  | "insurer"
  | "pension_fund"
  | "housing_ministry"
  | "aliyah_ministry"
  | "daycare_authority"
  | "discharged_fund";

/** Inputs the draft needs beyond the identity block (name / id / contact). */
export type FieldKey =
  | "municipality"
  | "counterparty"
  | "accountNumber"
  | "period"
  | "amount"
  | "details";

export interface RightAction {
  kind: ActionKind;
  /** Internal route for `tool` actions. Never an external URL. */
  tool?: string;
  recipient?: Recipient;
  fields?: FieldKey[];
  /** Document subject line (document language). */
  subject?: string;
  /**
   * The demand/application paragraph, document language. Written as a request
   * a real clerk can act on: what is asked, on what basis, what is expected
   * back. Deliberately conservative — it never asserts a specific sum the
   * engine cannot stand behind.
   */
  body?: string;
}

const IDENTITY = "{name}, ת״ז {id}";

/** Address block per recipient, in the document language (Hebrew for IL). */
export const RECIPIENT_HE: Record<Recipient, string> = {
  tax_authority: "לכבוד\nרשות המסים בישראל — משרד השומה",
  national_insurance: "לכבוד\nהמוסד לביטוח לאומי",
  municipality: "לכבוד\nמחלקת הגבייה והארנונה, עיריית/מועצת {municipality}",
  bank: "לכבוד\n{counterparty} — מחלקת שירות לקוחות",
  provider: "לכבוד\n{counterparty} — שירות לקוחות",
  employer: "לכבוד\n{counterparty} — מחלקת שכר ומשאבי אנוש",
  health_fund: "לכבוד\n{counterparty} — מחלקת החזרים",
  insurer: "לכבוד\n{counterparty} — מחלקת תביעות",
  pension_fund: "לכבוד\n{counterparty} — מחלקת שירות עמיתים",
  housing_ministry: "לכבוד\nמשרד הבינוי והשיכון — אגף הסיוע בדיור",
  aliyah_ministry: "לכבוד\nמשרד העלייה והקליטה",
  daycare_authority: "לכבוד\nמשרד העבודה — אגף בכיר למעונות יום ומשפחתונים",
  discharged_fund: "לכבוד\nהקרן לחיילים משוחררים",
};

/**
 * One entry per entitlement id in `rights.ts`. Kept in the same order as the
 * catalog so a missing pair is obvious; a unit test asserts full coverage.
 */
export const RIGHT_ACTIONS: Record<string, RightAction> = {
  // ---- Tax ----
  tax_refund: { kind: "tool", tool: "/taxrefund" },
  work_grant: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["period"],
    subject: "בקשה למענק עבודה (מס הכנסה שלילי) — {period}",
    body: `אני, ${IDENTITY}, מבקש/ת לבחון את זכאותי למענק עבודה עבור שנת המס {period}, בהתאם לחוק להגדלת שיעור ההשתתפות בכוח העבודה ולצמצום פערים חברתיים.
מצורפים פרטי ההכנסה הרלוונטיים. אבקש לקבל הודעה מנומקת בדבר הזכאות ושיעור המענק, ובמידה שהזכאות אושרה — לבצע את התשלום לחשבוני.`,
  },
  credit_children: {
    kind: "letter",
    recipient: "employer",
    fields: ["counterparty"],
    subject: "עדכון נקודות זיכוי בגין ילדים — תיאום מס",
    body: `אני, ${IDENTITY}, עובד/ת בארגונכם. אבקש לעדכן את נקודות הזיכוי המגיעות לי בגין ילדיי בטופס 101 ובחישוב המס השוטף, וכן לבצע החזר בגין חודשי השנה שבהם נוכה מס ביתר.
אבקש אישור בכתב על ביצוע העדכון ועל סכום ההחזר.`,
  },
  credit_degree: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["period"],
    subject: "בקשה להכרה בנקודות זיכוי בגין תואר אקדמי — {period}",
    body: `אני, ${IDENTITY}, סיימתי לימודים אקדמיים ומבקש/ת להכיר בנקודות הזיכוי המגיעות לי בגינם לשנות המס הרלוונטיות, לרבות החזר מס בגין שנים שבהן לא נוצלו.
מצורפת תעודת הזכאות/סיום. אבקש הודעה מנומקת ותשלום ההחזר לחשבוני.`,
  },
  credit_oleh: {
    kind: "letter",
    recipient: "tax_authority",
    subject: "בקשה לנקודות זיכוי לעולה חדש",
    body: `אני, ${IDENTITY}, עולה חדש/ה, ומבקש/ת להחיל את נקודות הזיכוי המגיעות לי כעולה לתקופת הזכאות הקבועה בדין, לרבות החזר בגין חודשים שבהם נוכה מס ביתר.
מצורפת תעודת עולה. אבקש הודעה מנומקת ותשלום ההחזר לחשבוני.`,
  },
  credit_discharged: {
    kind: "letter",
    recipient: "tax_authority",
    subject: "בקשה לנקודות זיכוי לחייל/ת משוחרר/ת",
    body: `אני, ${IDENTITY}, חייל/ת משוחרר/ת, ומבקש/ת להחיל את נקודות הזיכוי המגיעות לי בתקופת הזכאות שלאחר השחרור, לרבות החזר בגין חודשים שבהם נוכה מס ביתר.
מצורפת תעודת שחרור. אבקש הודעה מנומקת ותשלום ההחזר לחשבוני.`,
  },
  credit_donations: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["period", "amount"],
    subject: "בקשה לזיכוי מס בגין תרומות למוסד מוכר — {period}",
    body: `אני, ${IDENTITY}, מבקש/ת זיכוי מס בגין תרומות שנתתי בשנת המס {period} למוסדות ציבור מוכרים לפי סעיף 46 לפקודת מס הכנסה, בסכום כולל של כ-{amount}.
מצורפות הקבלות. אבקש לחשב את הזיכוי ולהעביר את ההחזר לחשבוני.`,
  },
  credit_pension_deposit: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["period"],
    subject: "בקשה לזיכוי/ניכוי בגין הפקדות לפנסיה וקרן השתלמות — {period}",
    body: `אני, ${IDENTITY}, ביצעתי הפקדות עצמאיות לחיסכון פנסיוני בשנת המס {period}, ומבקש/ת להחיל את הזיכוי והניכוי המגיעים לי בגינן.
מצורפים אישורי ההפקדה. אבקש חישוב מחדש והחזר המס שנוכה ביתר.`,
  },
  tax_disability_exemption: {
    kind: "letter",
    recipient: "tax_authority",
    subject: "בקשה לפטור ממס הכנסה לפי סעיף 9(5) לפקודה",
    body: `אני, ${IDENTITY}, מבקש/ת לבחון את זכאותי לפטור ממס הכנסה בגין נכות רפואית, לפי סעיף 9(5) לפקודת מס הכנסה, לרבות בחינה רטרואקטיבית לשנים הפתוחות.
אבקש לזמן אותי לוועדה הרפואית ולהודיע לי בכתב על החלטתכם.`,
  },
  credit_life_insurance: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["period", "amount"],
    subject: "בקשה לזיכוי מס בגין פרמיות ביטוח חיים ואובדן כושר עבודה — {period}",
    body: `אני, ${IDENTITY}, שילמתי בשנת המס {period} פרמיות בגין ביטוח חיים ו/או אובדן כושר עבודה בסכום כולל של כ-{amount}.
אבקש להחיל את הזיכוי המגיע לי בגינן לפי סעיף 45א לפקודת מס הכנסה, לרבות בחינה רטרואקטיבית לשנות המס הפתוחות.
מצורפים אישורי הפרמיה מהמבטח. אבקש חישוב מחדש והחזר המס שנוכה ביתר לחשבוני.`,
  },
  credit_special_needs_child: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["period"],
    subject: "בקשה לנקודות זיכוי בגין ילד עם נכות — {period}",
    body: `אני, ${IDENTITY}, הורה לילד/ה שנקבעה לגביו/ה נכות או החלטת ועדת השמה/זכאות ואפיון.
אבקש להחיל את נקודות הזיכוי המגיעות לי לפי סעיף 45 לפקודת מס הכנסה, לרבות לשנות המס הפתוחות שבהן לא נוצלו.
מצורפים המסמכים הרפואיים/החלטת הוועדה. אבקש הודעה מנומקת ותשלום ההחזר לחשבוני.`,
  },
  provident_withdrawal_refund: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["period", "amount"],
    subject: "בקשה להחזר מס בגין משיכת כספים מקופת גמל — {period}",
    body: `אני, ${IDENTITY}, משכתי בשנת המס {period} כספים מקופת גמל/קרן השתלמות בסכום של כ-{amount}, ונוכה מהם מס במקור בשיעור 35%.
שיעור זה גבוה משיעור המס השולי החל עליי בפועל באותה שנה. אבקש חישוב מס שנתי מלא והחזר ההפרש שנוכה ביתר.
מצורפים אישור הניכוי מהקופה וטופסי 106 הרלוונטיים.`,
  },
  betterment_tax_refund: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["period", "details"],
    subject: "בקשה לבחינה מחדש של שומת מס שבח — {period}",
    body: `אני, ${IDENTITY}, מכרתי זכות במקרקעין ושילמתי מס שבח בשנת {period}.
פרטי העסקה: {details}
אבקש לבחון מחדש את השומה, לרבות: תחולת פטורים שלא נוצלו, ניכוי מלוא ההוצאות המותרות (שכ״ט, מתווך, מס רכישה, שיפוצים ומימון), ופריסת השבח הריאלי לשנות מס קודמות.
אבקש הודעה מנומקת בכתב, ובמידה שנוצר עודף — החזרו לחשבוני בצירוף הפרשי הצמדה וריבית.`,
  },
  eligible_settlement_credit: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["period", "details"],
    subject: "בקשה לזיכוי ממס לתושב יישוב מזכה — {period}",
    body: `אני, ${IDENTITY}, תושב/ת היישוב {details}, המופיע ברשימת היישובים המזכים שבתוספת הראשונה לפקודת מס הכנסה.
אבקש להחיל את הזיכוי לפי סעיף 11 לפקודה לשנת המס {period} ולשנות המס הפתוחות שבהן לא נוצל.
מצורף אישור תושבות מהרשות המקומית. אבקש חישוב מחדש והחזר המס שנוכה ביתר לחשבוני.`,
  },

  // ---- National insurance ----
  child_allowance: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בדיקת קצבת ילדים ובחירת מסלול חיסכון",
    body: `אני, ${IDENTITY}, מבקש/ת לקבל אישור על קצבאות הילדים המשולמות לי, לבדוק שכל ילדיי רשומים, ולעדכן את מסלול החיסכון לכל ילד/ה.
אבקש הודעה בכתב על הרישום הקיים ועל כל פער שנמצא.`,
  },
  maternity_grant: { kind: "tool", tool: "/maternity" },
  unemployment_benefit: { kind: "tool", tool: "/unemployment" },
  income_support: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בקשה לבחינת זכאות להבטחת הכנסה",
    body: `אני, ${IDENTITY}, מבקש/ת לבחון את זכאותי לגמלת הבטחת הכנסה בהתאם לנסיבותיי הכלכליות הנוכחיות.
אבקש לקבל רשימת מסמכים נדרשת ומועד לבדיקת הבקשה, ולקבל החלטה מנומקת בכתב.`,
  },
  old_age_pension: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בקשה לבדיקת קצבת אזרח ותיק והשלמת הכנסה",
    body: `אני, ${IDENTITY}, מבקש/ת לבדוק את זכאותי לקצבת אזרח ותיק ולתוספת השלמת הכנסה, לרבות תוספות ותק ותלויים שלא נכללו בחישוב.
אבקש פירוט מלא של אופן החישוב והודעה מנומקת על כל רכיב שלא שולם.`,
  },
  miluim_pay: { kind: "tool", tool: "/miluim" },
  disability_allowance: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בקשה לבחינת זכאות לקצבת נכות כללית",
    body: `אני, ${IDENTITY}, מבקש/ת לבחון את זכאותי לקצבת נכות כללית ולהטבות הנלוות לה.
אבקש לזמן אותי לוועדה הרפואית, ולקבל החלטה מנומקת בכתב הכוללת את אחוזי הנכות שנקבעו ואת דרכי הערר.`,
  },
  mobility_allowance: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בקשה לבחינת זכאות לגמלת ניידות",
    body: `אני, ${IDENTITY}, מבקש/ת לבחון את זכאותי לגמלת ניידות ולהטבות הנלוות (הלוואה עומדת, חניית נכה, פטור מאגרת רישוי).
אבקש זימון לוועדה הרפואית לניידות והחלטה מנומקת בכתב.`,
  },
  long_term_care_benefit: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בקשה לבחינת זכאות לגמלת סיעוד",
    body: `אני, ${IDENTITY}, מבקש/ת לבחון את זכאותי לגמלת סיעוד לפי חוק הביטוח הלאומי (פרק הסיעוד).
אבקש לזמן אותי להערכת תלות תפקודית בבית, ולקבל החלטה מנומקת בכתב הכוללת את הזכאות למבחן ההכנסות.`,
  },
  tax_coordination: {
    kind: "letter",
    recipient: "tax_authority",
    fields: ["details"],
    subject: "בקשה לתיאום מס בין מספר מעסיקים",
    body: `אני, ${IDENTITY}, עובד/ת אצל יותר ממעסיק אחד או החלפתי מקום עבודה במהלך השנה: {details}.
כל מעסיק מנכה מס כאילו הוא המעסיק היחיד, מה שגורם לניכוי ביתר. אבקש לתאם את המס בין המעסיקים או לבדוק זכאותי להחזר בגין ניכוי ביתר.`,
  },

  // ---- Municipal ----
  arnona_income: {
    kind: "letter",
    recipient: "municipality",
    fields: ["municipality"],
    subject: "בקשה להנחה בארנונה בגין מבחן הכנסה",
    body: `אני, ${IDENTITY}, מחזיק/ה בנכס בתחום הרשות ומבקש/ת הנחה בארנונה על בסיס מבחן הכנסה, בהתאם לתקנות הסדרים במשק המדינה (הנחה מארנונה).
אבקש לקבל את רשימת המסמכים הנדרשת, לבחון את הבקשה גם ביחס לשנת הכספים הנוכחית, ולקבל החלטה מנומקת בכתב.`,
  },
  arnona_oleh: {
    kind: "letter",
    recipient: "municipality",
    fields: ["municipality"],
    subject: "בקשה להנחה בארנונה לעולה חדש",
    body: `אני, ${IDENTITY}, עולה חדש/ה, ומבקש/ת את ההנחה בארנונה המגיעה לעולים בתקופת הזכאות הקבועה בתקנות.
מצורפת תעודת עולה. אבקש להחיל את ההנחה ממועד תחילת הזכאות ולזכות אותי בגין תשלומי יתר ששולמו.`,
  },
  arnona_senior: {
    kind: "letter",
    recipient: "municipality",
    fields: ["municipality"],
    subject: "בקשה להנחה בארנונה לאזרח ותיק",
    body: `אני, ${IDENTITY}, אזרח/ית ותיק/ה, ומבקש/ת את ההנחה בארנונה המגיעה לי לפי מעמדי ולפי מבחן ההכנסה החל עליי.
אבקש להחיל את ההנחה משנת הכספים הנוכחית ולזכות אותי בגין תשלומי יתר, ולקבל החלטה מנומקת בכתב.`,
  },
  arnona_disability: {
    kind: "letter",
    recipient: "municipality",
    fields: ["municipality"],
    subject: "בקשה להנחה בארנונה בגין נכות",
    body: `אני, ${IDENTITY}, בעל/ת נכות מוכרת, ומבקש/ת את ההנחה בארנונה המגיעה לי לפי תקנות ההנחה מארנונה.
מצורף אישור הנכות. אבקש להחיל את ההנחה ולזכות אותי בגין תקופות שבהן שילמתי ביתר.`,
  },
  arnona_soldier: {
    kind: "letter",
    recipient: "municipality",
    fields: ["municipality"],
    subject: "בקשה להנחה בארנונה לחייל/ת בשירות סדיר",
    body: `אני, ${IDENTITY}, בשירות סדיר, ומבקש/ת את ההנחה בארנונה המגיעה לחיילים בהתאם לתקנות.
מצורף אישור שירות. אבקש להחיל את ההנחה ולזכות אותי בגין תשלומי יתר.`,
  },
  arnona_large_family: {
    kind: "letter",
    recipient: "municipality",
    fields: ["municipality"],
    subject: "בקשה להנחה בארנונה למשפחה מרובת ילדים",
    body: `אני, ${IDENTITY}, הורה למשפחה מרובת ילדים, ומבקש/ת לבחון את זכאותי להנחה בארנונה בהתאם לתקנות הסדרים במשק המדינה (הנחה מארנונה) ולנוהל הרשות המקומית.
אבקש לקבל את רשימת המסמכים הנדרשת (כולל אישור על מספר הילדים והכנסת המשפחה), ולקבל החלטה מנומקת בכתב.`,
  },
  water_disability: {
    kind: "letter",
    recipient: "municipality",
    fields: ["municipality"],
    subject: "בקשה להקצאת מים נוספת בגין צריכה רפואית",
    body: `אני, ${IDENTITY}, מבקש/ת להכיר בזכאותי להקצאת מים נוספת בשל צריכה רפואית מוגברת, בהתאם לכללי תאגידי המים.
מצורף האישור הרפואי. אבקש להחיל את ההקצאה ולזכות אותי בגין חיובים שנגבו ביתר.`,
  },
  arnona_area_correction: {
    kind: "letter",
    recipient: "municipality",
    fields: ["municipality", "details"],
    subject: "בקשה לתיקון שטח הנכס לצורכי ארנונה",
    body: `אני, ${IDENTITY}, מבקש/ת לבדוק את השטח הרשום לנכסי לצורכי חיוב ארנונה: {details}.
אם השטח הרשום גבוה מהשטח בפועל, אבקש לתקן את החיוב מכאן ואילך ולזכות אותי בגין תשלומי יתר בהתאם למדיניות הרשות.`,
  },
  water_leak_credit: {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "accountNumber", "details"],
    subject: "בקשה להנחה בגין נזילה סמויה",
    body: `אני, ${IDENTITY}, לקוח/ה מספר {accountNumber}. חשבון המים שלי חריג בתקופה האחרונה עקב נזילה סמויה שתוקנה: {details}.
מצורף אישור אינסטלטור מוסמך על תיקון הנזילה. אבקש להחיל את ההנחה בתעריף החל על נזילה סמויה בהתאם לכללי תאגיד המים, בכפוף למועדים ולתנאים הנהוגים אצלכם.`,
  },

  // ---- Banking ----
  bank_basic_track: {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "בקשה למעבר למסלול עמלות בסיסי והחזר עמלות שנגבו ביתר",
    body: `אני, ${IDENTITY}, בעל/ת חשבון מספר {accountNumber} אצלכם. אבקש להעביר את חשבוני למסלול העמלות הבסיסי, ולקבל פירוט מלא של העמלות שנגבו ממני בשנה האחרונה.
ככל שנגבו עמלות מעבר למסלול או עמלות כפולות — אבקש לזכות את חשבוני בהתאם. אבקש תשובה בכתב תוך 14 ימים.`,
  },
  bank_senior_track: {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "בקשה למסלול עמלות מוזל (אזרח ותיק / בעל נכות)",
    body: `אני, ${IDENTITY}, בעל/ת חשבון מספר {accountNumber}, וזכאי/ת להנחה בעמלות בהתאם להוראות המפקח על הבנקים.
אבקש להחיל עליי את המסלול המוזל, לרבות רטרואקטיבית ממועד היווצרות הזכאות, ולזכות את חשבוני בהפרש.`,
  },
  bank_soldier_student: {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "בקשה לפטור/הנחה בעמלות — חייל/ת או סטודנט/ית",
    body: `אני, ${IDENTITY}, בעל/ת חשבון מספר {accountNumber}, ומבקש/ת להחיל את הפטור או ההנחה בעמלות המגיעים לי לפי מעמדי.
מצורף האישור הרלוונטי. אבקש להחיל רטרואקטיבית ממועד הזכאות ולזכות את חשבוני.`,
  },
  credit_report_free: {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty"],
    subject: "בקשה לקבלת נתוני האשראי והדירוג שלי",
    body: `אני, ${IDENTITY}, מבקש/ת לקבל את נתוני האשראי הרשומים על שמי אצלכם ואת אופן חישוב הדירוג, בהתאם לחוק נתוני אשראי ולחוק הגנת הפרטיות.
ככל שקיימים נתונים שגויים — אבקש לתקנם ולהודיע לי על התיקון בכתב.`,
  },
  dormant_money: {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty"],
    subject: "בקשה לאיתור כספים וחשבונות רדומים על שמי",
    body: `אני, ${IDENTITY}, מבקש/ת לבצע איתור של חשבונות, פיקדונות, ניירות ערך וכספים רדומים הרשומים על שמי או על שם קרוב שנפטר ואני יורשו.
אבקש דוח מפורט של כל הנכסים שאותרו ואת הליך שחרורם.`,
  },
  hishtalmut_withdrawal: {
    kind: "letter",
    recipient: "pension_fund",
    fields: ["counterparty", "accountNumber"],
    subject: "בקשה למשיכת כספי קרן השתלמות",
    body: `אני, ${IDENTITY}, עמית/ה מספר {accountNumber} בקרן ההשתלמות. חלפו 6 שנים לפחות מהפקדתי הראשונה.
אבקש לקבל אישור על זכאותי למשיכה פטורה ממס, ולבצע את המשיכה בהתאם.`,
  },

  // ---- Consumer ----
  mobile_check: { kind: "tool", tool: "/check" },
  electricity_switch: { kind: "tool", tool: "/electricity" },
  electricity_social: {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "accountNumber"],
    subject: "בקשה להנחה בתעריף החשמל (הנחה סוציאלית)",
    body: `אני, ${IDENTITY}, לקוח/ה מספר {accountNumber}, ומבקש/ת להחיל על חשבוני את ההנחה בתעריף החשמל המגיעה לי לפי מעמדי (זכאות סוציאלית / נכות / אזרח ותיק).
אבקש להחיל את ההנחה ממועד הזכאות ולזכות אותי בגין תשלומי יתר.`,
  },
  flight_comp: { kind: "tool", tool: "/flights" },
  subscription_audit: { kind: "tool", tool: "/scan" },
  insurance_duplicates: {
    kind: "letter",
    recipient: "insurer",
    fields: ["counterparty"],
    subject: "בקשה לבדיקת כפל ביטוחי והחזר פרמיות",
    body: `אני, ${IDENTITY}, מבוטח/ת אצלכם. אבקש לקבל פירוט מלא של הכיסויים שלי ושל הפרמיות שנגבו בשלוש השנים האחרונות.
ככל שקיים כפל כיסוי שאינו מזכה בפיצוי כפול — אבקש לבטל את הכיסוי המיותר ולהשיב לי את הפרמיות שנגבו בגינו.`,
  },
  pension_fees: {
    kind: "letter",
    recipient: "pension_fund",
    fields: ["counterparty", "accountNumber"],
    subject: "בקשה להפחתת דמי ניהול בחיסכון הפנסיוני",
    body: `אני, ${IDENTITY}, עמית/ה מספר {accountNumber}. אבקש לקבל את שיעורי דמי הניהול מהצבירה ומההפקדה החלים עליי, ולהפחיתם לרמה התחרותית המוצעת ללקוחות חדשים.
אבקש הודעה בכתב על השיעורים החדשים ועל מועד תחילתם. ככל שלא תתקבל הצעה מתאימה, אשקול ניוד הכספים.`,
  },
  duplicate_charge_dispute: {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "amount", "details"],
    subject: "תלונה על חיוב כפול / שגוי",
    body: `אני, ${IDENTITY}, מזהה חיוב כפול או שגוי בסך {amount} ₪ בעסקה שביצעתי אצלכם: {details}.
מצורף פירוט/צילום הקבלה או דף החשבון המראה את החיוב הכפול. אבקש לתקן את החיוב ולזכות אותי בסכום ששולם ביתר בהקדם האפשרי.`,
  },
  train_delay_compensation: {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "details"],
    subject: "בקשה לפיצוי בגין איחור/ביטול רכבת",
    body: `אני, ${IDENTITY}, נסעתי ברכבת ישראל וחוויתי איחור או ביטול משמעותי: {details}.
בהתאם לנוהל הפיצוי המפורסם של רכבת ישראל, אבקש לממש את הפיצוי המגיע לי (כרטיסייה/נסיעה חינם) בגין האירוע.`,
  },
  route6_dispute: {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "details"],
    subject: "ערר על חיוב כביש 6",
    body: `אני, ${IDENTITY}, מערער/ת על חיוב כביש 6 שקיבלתי: {details}.
אבקש להעביר את הערר לוועדת הערר הסטטוטורית ולבטל או לתקן את החיוב, לרבות במקרה שבו אינני הבעלים הרשום בעת ביצוע הנסיעה.`,
  },
  vehicle_license_fee_refund: {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "details"],
    subject: "בקשה להחזר יחסי על אגרת רישוי רכב",
    body: `אני, ${IDENTITY}, הוצאתי את רכבי מהכביש (ביטול רישוי) או שהרכב הוכרז אבדן גמור: {details}.
אבקש החזר יחסי על אגרת הרישוי ששולמה עבור התקופה שלאחר מכן, בהתאם לתקנות משרד התחבורה.`,
  },
  consumer_cancel14: {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "details"],
    subject: "הודעת ביטול עסקה לפי חוק הגנת הצרכן",
    body: `אני, ${IDENTITY}, מודיע/ה בזאת על ביטול העסקה שביצעתי אצלכם: {details}.
הביטול נעשה במסגרת הזכות הקבועה בחוק הגנת הצרכן, התשמ״א-1981. אבקש להשיב לי את מלוא התמורה ששילמתי בתוך 14 ימים ולהפסיק כל חיוב עתידי בגין העסקה.`,
  },
  consumer_telecom_exit: {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty", "accountNumber"],
    subject: "הודעת ניתוק/מעבר ובקשה להחזר חיובים לאחר מועד הניתוק",
    body: `אני, ${IDENTITY}, מנוי/ה מספר {accountNumber}, מודיע/ה על סיום ההתקשרות. לפי חוק התקשורת, הניתוק ייכנס לתוקף לא יאוחר מ-3 ימי עסקים ואין לגבות דמי יציאה או קנס.
אבקש אישור ניתוק בכתב, וכן החזר של כל סכום שייגבה לאחר מועד הניתוק.`,
  },

  // ---- Health ----
  health_dental_kids: {
    kind: "letter",
    recipient: "health_fund",
    fields: ["counterparty"],
    subject: "בקשה למימוש סל שיניים לילדים והחזר הוצאות",
    body: `אני, ${IDENTITY}, הורה לילדים המבוטחים אצלכם. אבקש פירוט של הטיפולים הנכללים בסל שירותי הבריאות לילדים ושל מה שנוצל בפועל.
בגין טיפולים ששילמתי עליהם מכיסי וכלולים בסל — אבקש החזר, בצירוף הקבלות.`,
  },
  health_glasses_kids: {
    kind: "letter",
    recipient: "health_fund",
    fields: ["counterparty"],
    subject: "בקשה להשתתפות/החזר בגין משקפיים ועדשות לילדים",
    body: `אני, ${IDENTITY}, מבקש/ת לממש את ההשתתפות המגיעה לילדיי בגין משקפיים או עדשות מגע במסגרת הביטוח המשלים.
מצורפות הקבלות. אבקש לבצע את ההחזר לחשבוני ולהודיע לי על היתרה הפנויה לשנה הנוכחית.`,
  },
  health_er_exemption: {
    kind: "letter",
    recipient: "health_fund",
    fields: ["counterparty", "details"],
    subject: "בקשה לפטור מהשתתפות עצמית בגין ביקור בחדר מיון",
    body: `אני, ${IDENTITY}, פניתי לחדר מיון בנסיבות הבאות: {details}.
מקרים אלה נכללים בעילות הפטור מהשתתפות עצמית. אבקש לבטל את החיוב, ואם כבר שולם — להשיבו לי.`,
  },

  // ---- Work ----
  work_havraa: { kind: "tool", tool: "/payslip" },
  work_pension_mandatory: { kind: "tool", tool: "/payslip" },
  work_travel: { kind: "tool", tool: "/payslip" },
  work_overtime: { kind: "tool", tool: "/payslip" },
  work_sick: { kind: "tool", tool: "/payslip" },

  // ---- Transport ----
  transport_youth: {
    kind: "letter",
    recipient: "provider",
    fields: ["counterparty"],
    subject: "בקשה להחלת פרופיל הנחה בתחבורה ציבורית והחזר נסיעות",
    body: `אני, ${IDENTITY}, זכאי/ת לפרופיל הנחה בתחבורה הציבורית (נוער/סטודנט/חייל).
אבקש להחיל את הפרופיל על כרטיס הרב-קו שלי ולהשיב לי את ההפרש בגין נסיעות שחויבו בתעריף מלא לאחר מועד הזכאות.`,
  },

  // ---- Education ----
  student_scholarships: {
    kind: "letter",
    recipient: "aliyah_ministry",
    subject: "בקשה לבחינת זכאות למלגות ומענקי לימודים",
    body: `אני, ${IDENTITY}, סטודנט/ית, ומבקש/ת לבחון את זכאותי למלגות ולמענקי לימוד המופעלים על ידכם.
אבקש לקבל את רשימת המסלולים שאני עומד/ת בתנאיהם, את המועדים הקובעים ואת המסמכים הנדרשים.`,
  },

  // ---- Army ----
  discharged_deposit: {
    kind: "letter",
    recipient: "discharged_fund",
    subject: "בקשה לפירוט ומימוש הפיקדון לחייל משוחרר",
    body: `אני, ${IDENTITY}, חייל/ת משוחרר/ת, ומבקש/ת לקבל פירוט מלא של יתרת הפיקדון האישי והמענק המיוחד, לרבות מועדי הזכאות והשימושים המותרים.
אבקש להנחות אותי בהליך המשיכה של הכספים העומדים לרשותי.`,
  },
  reservist_benefits: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בקשה לבדיקת מלוא ההטבות בגין שירות מילואים",
    body: `אני, ${IDENTITY}, משרת/ת מילואים. אבקש לקבל פירוט מלא של תגמולי המילואים ששולמו לי ושל המענקים הנוספים שאני זכאי/ת להם לפי היקף השירות.
ככל שקיים פער בין המגיע לבין ששולם — אבקש להשלימו ולהודיע לי בכתב.`,
  },

  // ---- Family ----
  daycare_subsidy: {
    kind: "letter",
    recipient: "daycare_authority",
    subject: "בקשה לבחינת זכאות לסבסוד מעון יום",
    body: `אני, ${IDENTITY}, הורה לילד/ה בגיל מעון ועובד/ת. אבקש לבחון את זכאותי לדרגת סבסוד במעון יום מוכר בהתאם למבחני ההכנסה והתעסוקה.
אבקש לקבל את דרגת הסבסוד שנקבעה, את אופן חישובה ואת מועד תחילת תוקפה.`,
  },
  child_savings: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בקשה לעדכון מסלול חיסכון לכל ילד והפקדה מוגדלת",
    body: `אני, ${IDENTITY}, הורה לילדים שנפתחו עבורם חשבונות "חיסכון לכל ילד". אבקש פירוט של המסלולים והיתרות הקיימות, ואת האפשרות לעדכן מסלול ולהגדיל את ההפקדה החודשית מקצבת הילדים.
אבקש אישור בכתב על העדכון שבוצע.`,
  },

  // ---- Seniors ----
  senior_card: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בקשה להנפקת תעודת אזרח ותיק ומימוש ההטבות הנלוות",
    body: `אני, ${IDENTITY}, ומבקש/ת להנפיק תעודת אזרח ותיק ולקבל פירוט של ההטבות הנלוות לה (תחבורה, תרבות, אגרות והנחות במוסדות ציבור).
אבקש לשלוח אליי את התעודה ואת פירוט ההטבות בכתב.`,
  },
  heating_grant: {
    kind: "letter",
    recipient: "national_insurance",
    subject: "בקשה למענק חימום",
    body: `אני, ${IDENTITY}, אזרח/ית ותיק/ה המקבל/ת השלמת הכנסה, ומבקש/ת לבחון את זכאותי למענק החימום השנתי.
ככל שהמענק לא שולם לי בשנים קודמות למרות הזכאות — אבקש לבחון תשלום רטרואקטיבי ולהודיע לי בכתב.`,
  },

  // ---- Housing ----
  rent_assistance: {
    kind: "letter",
    recipient: "housing_ministry",
    subject: "בקשה לסיוע בשכר דירה",
    body: `אני, ${IDENTITY}, שוכר/ת דירה, ומבקש/ת לבחון את זכאותי לסיוע בשכר דירה בהתאם לכללי משרד הבינוי והשיכון.
אבקש לקבל את רשימת המסמכים הנדרשת, את גובה הסיוע שנקבע ואת מועד תחילת התשלום, בהחלטה מנומקת בכתב.`,
  },
  mortgage_refinance: {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "בקשה לבחינת מיחזור משכנתה ולקבלת עמלת פירעון מוקדם",
    body: `אני, ${IDENTITY}, בעל/ת הלוואת משכנתה מספר {accountNumber}. אבקש לקבל את יתרת ההלוואה, את הרכב המסלולים והריביות, ואת גובה עמלת הפירעון המוקדם נכון להיום.
בנוסף, אבקש הצעה למיחזור ההלוואה בתנאים המשקפים את ריביות השוק הנוכחיות. אבקש תשובה בכתב תוך 14 ימים.`,
  },
};

/** Does this right have a matching in-app action? (Used by the coverage test.) */
export function actionFor(rightId: string): RightAction | undefined {
  return RIGHT_ACTIONS[rightId];
}
