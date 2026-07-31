/**
 * The sixth category: money you have not lost yet.
 *
 * WHY THIS IS A DIFFERENT SHAPE FROM EVERYTHING ELSE HERE
 *
 * Every other engine in this product is retrospective. Rights are money already
 * owed, overcharges are money already taken, captive pricing is money leaving
 * every month, incidents are money you could have claimed, dormant accounts are
 * money sitting somewhere with your name on it. All of them answer: what has
 * already gone wrong?
 *
 * This one answers: what is about to. And the arithmetic is better, because a
 * used car is one of the two or three largest transactions a household makes,
 * the information asymmetry is total, and the loss is not a monthly leak of
 * ₪80 — it is ₪30,000 in one afternoon, unrecoverable.
 *
 * THE PART EVERYBODY MISSES
 *
 * The usual advice is to look the vehicle up before you go. That is good advice
 * and it is not the strongest thing available, because a public lookup returns
 * what the registry happens to hold — and it is not what the law actually gives
 * a buyer.
 *
 * Israel has a statute written for precisely this: the seller, private or
 * dealer, must hand the buyer a written disclosure form before the sale, listing
 * ownership history, accident history, mileage and the rest. Almost nobody
 * knows it exists, so almost nobody asks, so almost nobody receives one — and a
 * seller who refuses to produce it has told you something more useful than any
 * database would have.
 *
 * That is the same pattern as the dormant module: the demand beats the search,
 * because a search returns an index and a demand puts a duty on somebody. It is
 * also why this fits in the app rather than pointing outward — the letter is
 * the product.
 *
 * WHAT THIS FILE REFUSES TO DO
 *
 * It states no valuation and no verdict on any particular car. It cannot: it
 * has never seen the vehicle, and a confident "this one is fine" would be the
 * most expensive sentence this product could print. What it does is name what
 * to demand, what each answer means, and which silence is itself an answer.
 */

/** What the buyer is entitled to be told, and why each one matters. */
export interface DisclosureItem {
  id: string;
  /** What to ask for, in the words to use. */
  demand: string;
  /**
   * Why it matters — the loss it prevents. Present because a checklist without
   * consequences gets skimmed, and this one is read in a car park under
   * pressure from somebody who wants the sale to close today.
   */
  why: string;
  /**
   * What it means when the seller will not or cannot produce it. Refusal is
   * information, and treating it as merely inconvenient is the mistake.
   */
  ifRefused: string;
}

/**
 * The statutory duty this rests on.
 *
 * Named rather than paraphrased, because a buyer quoting the law by name is
 * treated differently from a buyer asking a favour, and that difference is most
 * of the value of knowing it.
 */
export const DISCLOSURE_STATUTE =
  "חוק מכירת רכב משומש (מידע), התשס״ח-2008 — חובת מוכר, פרטי או סוחר, למסור לקונה טופס גילוי בכתב לפני המכירה";

export const VEHICLE_DISCLOSURE: readonly DisclosureItem[] = [
  {
    id: "ownership_history",
    demand: "פירוט כל הבעלויות הקודמות וסוג כל אחת — פרטית, חברה, ליסינג, השכרה או לימוד נהיגה",
    why: "רכב ליסינג או השכרה עבר נהגים רבים ותחזוקה לפי לוח זמנים, לא לפי צורך. אותו דגם ואותה שנה שווים פחות, וזה משפיע על המחיר יותר מכל דבר אחר ברשימה.",
    ifRefused:
      "זה הפריט שהכי קל למסור והכי מביך להסתיר. סירוב כאן הוא כמעט תמיד תשובה.",
  },
  {
    id: "accident_history",
    demand: "האם הרכב היה מעורב בתאונה, ואם כן — פירוט הנזק והתיקון",
    why: "רכב שעבר תאונה קשה וחזר לכביש נראה חדש ואינו חדש. שלד שתוקן לא חוזר לחוזק המקורי, וזה נושא בטיחות לפני שהוא נושא כספי.",
    ifRefused:
      "בקש בכתב. מוכר שמצהיר בעל פה שלא הייתה תאונה ומסרב לכתוב זאת — אמר לך את התשובה.",
  },
  {
    id: "odometer",
    demand: "קריאת מד האוץ הנוכחית, וקריאות קודמות מהטסטים והטיפולים",
    why: "מד אוץ שהוחזר אחורה הוא הזיוף הנפוץ ביותר בשוק, והוא משנה את שווי הרכב בעשרות אלפים. הקריאות ההיסטוריות הן מה שחושף אותו — מספר שיורד בין שני טסטים אינו שנוי במחלוקת.",
    ifRefused: "היסטוריית הקריאות קיימת ברישומים. מי שלא מוכן להראות אותה, יודע למה.",
  },
  {
    id: "dealer_chain",
    demand: "כמה סוחרים החזיקו ברכב ומתי, ואם המוכר הנוכחי הוא סוחר",
    why: "רכב שעבר כמה סוחרים בזמן קצר הוא רכב שאנשים בדקו והחזירו. וסוחר שמציג את עצמו כמוכר פרטי עושה זאת כדי להימנע מהאחריות שהחוק מטיל על סוחר.",
    ifRefused: "אם מתברר שהמוכר סוחר שהציג עצמו כפרטי — זו עילה בפני עצמה.",
  },
  {
    id: "test_validity",
    demand: "תוקף הטסט הנוכחי ומועד הטסט הבא",
    why: "טסט שפג בעוד שבועיים אינו פרט טכני — הוא עלות מיידית ולפעמים תנאי לרישוי.",
    ifRefused: "זה מידע פומבי ומיידי. סירוב כאן מעיד על היחס לכל השאר.",
  },
  {
    id: "liens",
    demand: "האם רשומים על הרכב שעבוד, עיקול או חוב",
    why: "רכב משועבד אינו עובר על שמך גם אחרי שהכסף עבר. זו הדרך היחידה ברשימה לאבד גם את הרכב וגם את הכסף.",
    ifRefused:
      "אל תשלם לפני שזה נבדק. זה הפריט היחיד כאן שמצדיק לעצור עסקה על אתר.",
  },
  {
    id: "recalls",
    demand: "האם קיים ריקול פתוח לדגם, והאם בוצע",
    why: "ריקול מטופל בחינם אצל היבואן. ריקול שלא בוצע הוא תקלה בטיחותית ידועה שנשארה ברכב.",
    ifRefused: "אפשר לברר מול היבואן לפי מספר השלדה, בלי המוכר.",
  },
  {
    id: "original_price",
    demand: "מחיר המחירון של הרכב כשהיה חדש, ורמת הגימור",
    why: "רמת גימור נמוכה שנמכרת כגבוהה היא הפער השקט. שני רכבים באותה שנה ואותו דגם יכולים להיות רחוקים אלפי שקלים זה מזה.",
    ifRefused: "המחירון פומבי; מה שהמוכר יודע ולא אומר הוא מה שרלוונטי.",
  },
];

export function disclosureItem(id: string): DisclosureItem | undefined {
  return VEHICLE_DISCLOSURE.find((d) => d.id === id);
}

export interface DisclosureLetterFields {
  buyerName?: string;
  buyerId?: string;
  sellerName?: string;
  /** Registration number, as written on the vehicle. */
  plate?: string;
}

/**
 * The written demand.
 *
 * Deliberately not aggressive. The purpose is to obtain a document, and the
 * fastest way to fail at that is to make an honest seller feel accused before
 * they have done anything. It cites the statute once, asks for the list, and
 * lets the request itself do the work — because the only sellers who find this
 * offensive are the ones with something on the list.
 */
export function buildDisclosureDemand(fields: DisclosureLetterFields = {}): {
  subject: string;
  body: string;
} {
  const plate = fields.plate?.trim() || "[מספר רישוי]";
  const buyer = fields.buyerName?.trim() || "[שם הקונה]";

  return {
    subject: `בקשה לטופס גילוי לפני רכישה — רכב ${plate}`,
    body: [
      fields.sellerName?.trim() ? `לכבוד ${fields.sellerName.trim()},` : "לכבוד המוכר,",
      "",
      `אני מעוניין/ת לרכוש את הרכב שמספר הרישוי שלו ${plate}.`,
      "",
      `לפי ${DISCLOSURE_STATUTE}, אבקש לקבל בכתב, לפני העסקה:`,
      "",
      ...VEHICLE_DISCLOSURE.map((d, i) => `${i + 1}. ${d.demand}`),
      "",
      "אשמח לקבל את הפרטים בכתב — הודעה כתובה מספיקה. זו בקשה שגרתית שהחוק מטיל על כל מוכר, ואינה טענה כלפיכם.",
      "",
      "בכבוד רב,",
      buyer,
      fields.buyerId?.trim() ? `ת״ז ${fields.buyerId.trim()}` : "",
    ]
      .filter((line) => line !== "")
      .join("\n"),
  };
}
