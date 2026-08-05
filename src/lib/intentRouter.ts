import { CATALOG, type PriorityAction } from "./priority";

/**
 * Free-text intent routing — "tell me what happened, I'll pick the door."
 *
 * The mobile nav menu lists ~55 tools; a first-time visitor describing a real
 * problem in their own words ("הפסיקו לגבות ממני על מנוי שביטלתי") has no way
 * to know which of those 55 labels matches "cancel" versus "refund-chase"
 * versus "complaint-escalation" — three genuinely different tools for three
 * subtly different situations. This is the "volume knob" for that: one free-
 * text box instead of a wall of buttons.
 *
 * Deterministic keyword matching, not an LLM call, on purpose (see
 * CLAUDE.md: "Prefer deterministic playbooks... alongside LLM drafts"):
 * it works with no AI key configured, costs nothing per keystroke, answers
 * instantly, and is fully unit-testable — a wrong AI guess here would send
 * someone to the wrong Case flow with no way to know why. The trade is a
 * curated keyword list per action instead of open-ended understanding; the
 * fallback for anything that doesn't score is the assistant chat, which can
 * actually reason about an ambiguous description.
 */

export interface IntentKeywords {
  id: string;
  /** Hebrew phrases/words a person would plausibly type, lowercased. */
  he: string[];
  /** English equivalents. */
  en: string[];
}

const KEYWORDS: IntentKeywords[] = [
  {
    id: "money",
    he: ["חיובים חוזרים", "מנויים שכחתי", "כל מה שאני משלם", "לסרוק את החשבון", "צילום מסך מהבנק"],
    en: ["recurring charges", "what am i paying", "scan my bank", "screenshot my statement"],
  },
  {
    id: "must-have",
    he: ["מה חובה לעשות", "חבילת חובה", "מה כולם צריכים", "מאיפה מתחילים", "כל הכלים החשובים"],
    en: ["must have", "where do i start", "essential tools", "starter pack", "what should everyone do"],
  },
  {
    id: "cancel",
    he: ["בטל מנוי", "לבטל מנוי", "להוריד לי מחיר", "מנוי שלא רוצה", "נטפליקס", "ספוטיפיי", "חדר כושר"],
    en: ["cancel subscription", "cancel my", "lower my bill", "gym membership", "streaming"],
  },
  {
    id: "check",
    he: ["חשבון סלולר", "חשבון גבוה מדי", "לקוח ותיק", "לא מקבל הנחה", "פרטנר", "סלקום", "פלאפון", "הוט מובייל"],
    en: ["phone bill", "mobile bill too high", "loyal customer discount"],
  },
  {
    id: "bank-fees",
    he: ["עמלת בנק", "עמלות בנק", "עמלה מוזרה", "חייבו אותי עמלה", "עמלת ניהול חשבון"],
    en: ["bank fee", "bank charged me", "account maintenance fee"],
  },
  {
    id: "electricity",
    he: ["חשבון חשמל", "חשמל יקר", "לעבור ספק חשמל"],
    en: ["electricity bill", "switch electricity supplier"],
  },
  {
    id: "refund-chase",
    he: ["לא קיבלתי החזר", "הבטיחו לי החזר", "מחכה להחזר כסף", "זיכוי שלא הגיע"],
    en: ["refund never arrived", "waiting for refund", "credit never came"],
  },
  {
    id: "credit-card",
    he: ["ריבית כרטיס אשראי", "יתרה מתגלגלת", "חוב בכרטיס אשראי"],
    en: ["credit card interest", "revolving balance"],
  },
  {
    id: "duplicate-insurance",
    he: ["ביטוח כפול", "משלם על שני ביטוחים", "ביטוח מיותר"],
    en: ["duplicate insurance", "paying for two policies"],
  },
  {
    id: "pension-fees",
    he: ["דמי ניהול פנסיה", "עמלות פנסיה", "קרן פנסיה גובה יותר מדי"],
    en: ["pension management fee", "pension fees too high"],
  },
  {
    id: "payslip",
    he: ["תלוש שכר", "בדיקת תלוש", "לא בטוח שהשכר נכון", "הפרשות פנסיה מהמעסיק"],
    en: ["payslip", "check my salary", "employer pension contributions"],
  },
  {
    id: "severance",
    he: ["פוטרתי", "פיצויי פיטורים", "פיטרו אותי ולא קיבלתי"],
    en: ["i was fired", "severance pay", "laid off"],
  },
  {
    id: "maternity",
    he: ["דמי לידה", "יצאתי ללידה", "חופשת לידה תשלום"],
    en: ["maternity pay", "maternity allowance"],
  },
  {
    id: "unemployment",
    he: ["דמי אבטלה", "פיטרו אותי מה מגיע לי מהמדינה", "רשום באבטלה"],
    en: ["unemployment benefit", "jobseeker payment"],
  },
  {
    id: "miluim",
    he: ["מילואים", "יצאתי למילואים", "המעביד לא שילם על מילואים"],
    en: ["reserve duty pay", "miluim"],
  },
  {
    id: "taxrefund",
    he: ["החזר מס", "עבדתי חלק מהשנה", "מגיע לי החזר ממס הכנסה"],
    en: ["tax refund", "worked part of the year"],
  },
  {
    id: "flights",
    he: ["טיסה התעכבה", "טיסה בוטלה", "פיצוי טיסה", "חברת תעופה"],
    en: ["flight delayed", "flight cancelled", "airline compensation"],
  },
  {
    id: "parking",
    he: ["דוח חניה", "קנס חניה", "ערעור על דוח"],
    en: ["parking ticket", "parking fine appeal"],
  },
  {
    id: "warranty",
    he: ["אחריות מוצר", "המכשיר התקלקל", "תיקון באחריות", "יבואן לא מתקן", "איבדתי קבלה אבל באחריות"],
    en: ["product warranty", "device broke under warranty", "warranty repair", "importer won't fix"],
  },
  {
    id: "transport-fine",
    he: ["קנס תחבורה ציבורית", "נסעתי בלי כרטיס", "קנס באוטובוס", "קנס ברכבת"],
    en: ["public transport fine", "bus fine", "train fine"],
  },
  {
    id: "late-payment",
    he: ["לקוח לא משלם לי", "חשבונית שלא שולמה", "חייבים לי כסף מלקוח"],
    en: ["client not paying", "unpaid invoice"],
  },
  {
    id: "overtime-backpay",
    he: ["שעות נוספות שלא שולמו", "לא קיבלתי תשלום על שעות נוספות"],
    en: ["unpaid overtime"],
  },
  {
    id: "deposit",
    he: ["בעל הבית לא מחזיר פיקדון", "פיקדון שכירות", "המשכיר לא מחזיר לי כסף"],
    en: ["landlord deposit", "security deposit not returned"],
  },
  {
    id: "consumer-cancel",
    he: ["ביטול תוך 14 יום", "קניתי מרחוק", "קורס אונליין", "מכירה מדלת לדלת", "ביטול עסקה"],
    en: ["14 day cancellation", "bought online", "online course cancel", "door to door sale"],
  },
  {
    id: "collection-complaint",
    he: ["גובה חוב", "מעגל שלישי", "מתקשרים על חוב", "הטרדה על חוב"],
    en: ["debt collector", "collection agency", "harassing calls about debt"],
  },
  {
    id: "toll-dispute",
    he: ["כביש 6", "חיוב כביש", "דרך ארץ", "חויבתי בכביש"],
    en: ["highway 6", "toll charge", "road 6 charge"],
  },
  {
    id: "car-insurance-refund",
    he: ["ביטלתי ביטוח רכב", "החזר ביטוח", "מכרתי את הרכב ביטוח"],
    en: ["cancelled car insurance", "car insurance refund"],
  },
  {
    id: "contract-check",
    he: ["לפני שאני חותם", "לבדוק חוזה", "מה כתוב בקטן"],
    en: ["review a contract", "before i sign"],
  },
  {
    id: "scam-check",
    he: ["הודעה חשודה", "זה נראה כמו הונאה", "קיבלתי סמס מוזר", "וואטסאפ חשוד"],
    en: ["suspicious message", "is this a scam", "phishing text"],
  },
  {
    id: "complaint-escalation",
    he: ["התלונה שלי לא נענתה", "פניתי ולא ענו לי", "מי מפקח על"],
    en: ["complaint ignored", "no response to my complaint"],
  },
  {
    id: "deadlines",
    he: ["תזכיר לי לפני שפג תוקף", "תאריך חשוב שלא לשכוח"],
    en: ["remind me before it expires", "important deadline"],
  },
  {
    id: "advance-tax",
    he: ["מקדמות מס גבוהות מדי", "עצמאי ומשלם מקדמות"],
    en: ["advance tax too high", "self employed advances"],
  },
  {
    id: "school-payments",
    he: ["תשלום לגן", "תשלום לבית הספר", "חייבים אותי לשלם לגן"],
    en: ["kindergarten payment", "school payment"],
  },
  {
    id: "dormant",
    he: ["כסף ששכחתי", "חשבון ישן שלי", "ירושה שלא ידעתי עליה"],
    en: ["forgotten money", "old account", "unclaimed inheritance"],
  },
  {
    id: "vehicleCheck",
    he: ["קונה רכב יד שנייה", "לפני שאני קונה רכב"],
    en: ["buying a used car"],
  },
  {
    id: "incident",
    he: ["נפצעתי", "תאונה", "תביעת ביטוח על פציעה"],
    en: ["i was injured", "accident claim"],
  },
  {
    id: "mortgage",
    he: ["מיחזור משכנתא", "ריבית המשכנתא גבוהה", "לבדוק את המשכנתא שלי"],
    en: ["refinance my mortgage", "mortgage interest rate", "check my mortgage"],
  },
  {
    id: "disability-benefits",
    he: ["קצבת נכות", "אחוזי נכות", "ביטוח לאומי נכות"],
    en: ["disability benefits", "disability allowance", "disability claim"],
  },
  {
    id: "class-action",
    he: ["תביעה ייצוגית", "האם אני חלק מהתביעה", "זיכוי אוטומטי לחשבון"],
    en: ["class action", "am i part of the lawsuit", "settlement credit"],
  },
  {
    id: "alimony-guarantee",
    he: ["מזונות מובטחים", "אבא לא משלם מזונות", "אמא לא משלמת מזונות", "ההורה השני לא משלם"],
    en: ["guaranteed alimony", "other parent not paying child support", "ex not paying support"],
  },
  {
    id: "business-compensation",
    he: ["נזק עקיף", "פיצויים לעסק מהמלחמה", "ירידה במחזור בגלל המלחמה"],
    en: ["indirect war damage", "business compensation war", "revenue drop from the war"],
  },
];

const BY_ID = new Map(CATALOG.map((a) => [a.id, a]));
const NORMALIZE = (s: string) => s.trim().toLowerCase();
/** Below this, a word is too generic on its own ("לא", "the") to count. */
const MIN_WORD_LEN = 3;

function words(phrase: string): string[] {
  return NORMALIZE(phrase)
    .split(/\s+/)
    .filter((w) => w.length >= MIN_WORD_LEN);
}

/**
 * Score every candidate by how much of each keyword PHRASE's own wording
 * shows up in the input, word by word — not a single exact substring of the
 * whole phrase, which real free text almost never matches verbatim ("my
 * flight was cancelled" contains "flight" and "cancelled" but not the exact
 * substring "flight cancelled"). A phrase only contributes once its words
 * are essentially all present, so a lone generic word ("כרטיס" alone)
 * can't route someone into a Case flow on its own — a real phrase's worth of
 * overlap has to be there.
 */
export function matchIntent(input: string, locale: "he" | "en" = "he"): PriorityAction | null {
  const text = NORMALIZE(input);
  if (text.length < 4) return null;

  let best: { id: string; score: number } | null = null;
  for (const entry of KEYWORDS) {
    const phrases = locale === "en" ? entry.en : entry.he;
    let score = 0;
    for (const phrase of phrases) {
      const tokens = words(phrase);
      if (tokens.length === 0) continue;
      const hits = tokens.filter((w) => text.includes(w)).length;
      // Require essentially the whole phrase's words to be present (allow
      // one miss on longer phrases) before it contributes at all.
      if (hits >= tokens.length - (tokens.length > 2 ? 1 : 0)) {
        score += phrase.length;
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { id: entry.id, score };
  }
  if (!best) return null;
  return BY_ID.get(best.id) ?? null;
}
