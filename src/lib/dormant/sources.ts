/**
 * The fifth category: money that is already yours and nobody is looking for.
 *
 * WHY THIS IS DIFFERENT FROM THE OTHER FOUR
 *
 * Rights depend on who you are. Overcharges and captive pricing depend on what
 * you pay. Incident claims depend on what happened to you. All four require the
 * person to have a claim.
 *
 * Here there is no claim to make. The money is already theirs, sitting in an
 * account with their name on it, at an institution that knows exactly where it
 * is and has no commercial reason to find them. Nobody is withholding anything;
 * the person simply stopped existing as far as that institution's mail is
 * concerned — they changed jobs, changed banks, moved house, or died.
 *
 * THE MECHANISM THAT ACTUALLY WORKS, AND IT IS NOT SEARCH
 *
 * The instinct is to search a registry. Registries help, and they are also why
 * this money has stayed unclaimed for decades: a search returns what the
 * registry happens to hold, on the identifier it happens to be indexed by, and
 * a person who searches once, finds nothing, and concludes they have nothing is
 * now worse off than before they looked.
 *
 * What actually moves money is a written demand for disclosure addressed to the
 * institution itself. It creates a dated record, it places a duty to answer on
 * a regulated body, and — the part that matters — it is answered against the
 * institution's own records rather than against an index. This is also why it
 * can be done entirely inside the app: the letter is the product, and no
 * external site is involved at any point.
 *
 * THE PART THAT COMPOUNDS
 *
 * Every job change leaves something behind. A person with six employers has six
 * eras in which a provident fund, a study fund or a pension was opened in their
 * name and abandoned at the next hire. They cannot name any of them, which is
 * exactly why nobody claims. But the *count* is something anybody can answer in
 * one tap, and the count is what generates the letters.
 *
 * WHAT THIS FILE REFUSES TO DO
 *
 * It states no amount, not even a range. A dormant account has no typical size:
 * it is nine shekels or ninety thousand, and the distribution is not something
 * anybody outside the institution can see. Every other module here at least has
 * a market to reason about. This one does not, and inventing a figure to make
 * the screen more exciting would be the purest form of the fabrication the
 * whole product is built to avoid.
 *
 * What it does quantify is the only honest number available: how many
 * institutions are under a duty to answer you.
 */

/** Who the money is sitting with. */
export type Holder =
  | "pension_fund"
  | "provident_fund"
  | "study_fund"
  | "insurer"
  | "bank"
  | "employer"
  | "securities_firm"
  | "authority";

/** Whose money it is, from the perspective of the person holding the phone. */
export type Claimant = "self" | "heir" | "both";

export interface DormantFacts {
  /** How many employers they have had. The single most productive question here. */
  pastEmployers?: number;
  /** Ever switched their main bank. Old accounts do not close themselves. */
  changedBank?: boolean;
  /** Ever had a study fund — often left liquid and forgotten after a job change. */
  hadStudyFund?: boolean;
  /** Moved home. Returned post is the most common way an account goes quiet. */
  movedHome?: boolean;
  /** Held shares or a portfolio at some point, including through an employer. */
  heldSecurities?: boolean;
  /** Paid a rental deposit or guarantee that was never returned. */
  unreturnedDeposit?: boolean;
  /** A close relative died and the family never mapped what they held. */
  deceasedRelative?: boolean;
  /** Family present in Europe before 1945 — a separate statutory restitution route. */
  preWarFamily?: boolean;
  /** Worked or lived abroad; foreign pension entitlements survive the return. */
  workedAbroad?: boolean;
}

export interface DormantSource {
  id: string;
  holder: Holder;
  claimant: Claimant;
  /**
   * The duty that makes a letter work. Without one this is a polite request an
   * institution may ignore; with one it is an obligation with a clock on it.
   */
  duty: string;
  /** Why this person plausibly has something here. Shown, never assumed silently. */
  whyYou: string;
  /** What they need in hand. Short, or people read it as a refusal. */
  needs: string[];
  /**
   * How many separate letters this generates. Employment-era sources produce one
   * per employer, which is the whole point: six jobs is six institutions, not one.
   */
  perEmployer?: boolean;
  applies: (f: DormantFacts) => boolean;
}

const yes = (v: boolean | undefined) => v === true;

export const IL_DORMANT: readonly DormantSource[] = [
  {
    id: "old_provident_funds",
    holder: "provident_fund",
    claimant: "self",
    duty: "חוק הפיקוח על שירותים פיננסיים (קופות גמל), התשס״ה-2005 — חובת דיווח שנתי לעמית וחובת איתור עמיתים",
    whyYou:
      "כל מעסיק פותח הפקדות על שמך. במעבר לעבודה הבאה החשבון נשאר פתוח, ולרוב מפסיק להישלח אליך דיווח",
    needs: ["שמות המעסיקים הקודמים, ככל שאתה זוכר", "מספר זהות"],
    perEmployer: true,
    applies: (f) => (f.pastEmployers ?? 0) >= 1,
  },
  {
    id: "old_pension",
    holder: "pension_fund",
    claimant: "both",
    duty: "חוק הפיקוח על שירותים פיננסיים (קופות גמל), התשס״ה-2005 — זכות עמית ויורש לקבל מידע על זכויות",
    whyYou:
      "קרן פנסיה שנפתחה אצל מעסיק קודם ממשיכה להתקיים גם כשההפקדות נפסקו, לרוב תוך שחיקה בדמי ניהול",
    needs: ["תקופות ההעסקה", "מספר זהות"],
    perEmployer: true,
    applies: (f) => (f.pastEmployers ?? 0) >= 1,
  },
  {
    id: "study_fund",
    holder: "study_fund",
    claimant: "self",
    duty: "חוק הפיקוח על שירותים פיננסיים (קופות גמל), התשס״ה-2005",
    whyYou:
      "קרן השתלמות הופכת נזילה אחרי שש שנים ואז נשכחת. הכסף נשאר בקופה וממשיך להיגבות ממנו דמי ניהול",
    needs: ["שם המעסיק שבו נפתחה", "מספר זהות"],
    applies: (f) => yes(f.hadStudyFund) || (f.pastEmployers ?? 0) >= 2,
  },
  {
    id: "dormant_bank_account",
    holder: "bank",
    claimant: "both",
    duty: "הוראות ניהול בנקאי תקין — חשבונות ללא תנועה וחובת איתור בעלי חשבון",
    whyYou:
      "חשבון שהופסק השימוש בו אינו נסגר מעצמו. יתרות, פיקדונות וניירות ערך נשארים בו, ולעיתים גם נגבות ממנו עמלות",
    needs: ["שמות הבנקים שבהם היה לך חשבון", "מספר זהות"],
    applies: (f) => yes(f.changedBank) || yes(f.movedHome),
  },
  {
    id: "unclaimed_policies",
    holder: "insurer",
    claimant: "both",
    duty: "חוק חוזה הביטוח, התשמ״א-1981, וחוזרי רשות שוק ההון בעניין איתור מוטבים ובעלי פוליסות",
    whyYou:
      "פוליסות חיים וחיסכון שנרכשו לפני שנים, לעיתים דרך מעסיק, ממשיכות להתקיים גם כשאיש לא זוכר אותן",
    needs: ["שמות חברות הביטוח, ככל שידוע", "מספר זהות"],
    applies: (f) => (f.pastEmployers ?? 0) >= 1 || yes(f.movedHome),
  },
  {
    id: "deceased_policies",
    holder: "insurer",
    claimant: "heir",
    // The largest single pocket in this category, and the one nobody opens. A
    // family that has just buried somebody does not begin by auditing their
    // financial products, and by the time anybody thinks of it the person who
    // knew what existed is the person who died.
    duty: "חוק חוזה הביטוח, התשמ״א-1981; חוק הירושה, התשכ״ה-1965 — זכות יורש לקבל מידע על נכסי המוריש",
    whyYou:
      "מי שנפטר משאיר פוליסות, קרנות וחשבונות שהמשפחה לרוב אינה יודעת עליהם. המבטח אינו חייב לאתר אתכם ביוזמתו",
    needs: ["תעודת פטירה", "צו ירושה או צו קיום צוואה", "מספר הזהות של הנפטר"],
    applies: (f) => yes(f.deceasedRelative),
  },
  {
    id: "deceased_pension",
    holder: "pension_fund",
    claimant: "heir",
    duty: "חוק הפיקוח על שירותים פיננסיים (קופות גמל), התשס״ה-2005 — זכויות שאירים ויורשים",
    whyYou:
      "קרנות פנסיה וקופות גמל של נפטר עוברות לשאירים או ליורשים, אך רק לאחר פנייה — הקרן אינה יוזמת",
    needs: ["תעודת פטירה", "צו ירושה או צו קיום צוואה"],
    applies: (f) => yes(f.deceasedRelative),
  },
  {
    id: "forgotten_securities",
    holder: "securities_firm",
    claimant: "both",
    duty: "הוראות ניהול בנקאי תקין — ניירות ערך בחשבונות ללא תנועה; חובת דיווח למחזיק",
    whyYou:
      "מניות שהתקבלו מהמעסיק, הנפקות ישנות ודיבידנדים שלא נמשכו נשארים רשומים על שמך גם עשורים אחר כך",
    needs: ["שם הבנק או חבר הבורסה", "מספר זהות"],
    applies: (f) => yes(f.heldSecurities),
  },
  {
    id: "unreturned_deposit",
    holder: "employer",
    claimant: "self",
    duty: "חוק החוזים (חלק כללי), התשל״ג-1973 — השבת מה שנמסר להבטחת חיוב שהסתיים",
    whyYou:
      "פיקדון או ערבות שנמסרו להשכרה, לעבודה או לשירות ולא הוחזרו בתום ההתקשרות נשארים חוב לכל דבר",
    needs: ["פרטי ההתקשרות ומועד סיומה", "אסמכתה על התשלום, אם יש"],
    applies: (f) => yes(f.unreturnedDeposit),
  },
  {
    id: "restitution",
    holder: "authority",
    claimant: "both",
    duty: "חוק נכסים של נספי השואה (השבה ליורשים והקדשה למטרות סיוע והנצחה), התשס״ו-2006",
    whyYou:
      "נכסים, חשבונות ופוליסות של נספי השואה מוחזקים בנאמנות ומוחזרים ליורשים לפי בקשה מנומקת",
    needs: ["שמות בני המשפחה ומקום מגוריהם לפני המלחמה", "קשר משפחתי מתועד"],
    applies: (f) => yes(f.preWarFamily),
  },
  {
    id: "foreign_pension",
    holder: "authority",
    claimant: "both",
    duty: "אמנות לביטחון סוציאלי שישראל צד להן — שמירת זכויות פנסיה שנצברו בחו״ל",
    whyYou:
      "זכויות פנסיה שנצברו בעבודה בחו״ל אינן פוקעות בחזרה לארץ, ובחלק מהמדינות הן משולמות רק לפי דרישה",
    needs: ["המדינה ותקופות העבודה", "מספר ביטוח מקומי, אם ידוע"],
    applies: (f) => yes(f.workedAbroad),
  },
];

export function dormantById(id: string): DormantSource | undefined {
  return IL_DORMANT.find((s) => s.id === id);
}
