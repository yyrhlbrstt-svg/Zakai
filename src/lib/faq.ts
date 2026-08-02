/**
 * Canonical FAQ knowledge base — public /faq + assistant alignment.
 */
import { agentPlaybookBlock } from "./agentPlaybook";

export type FaqCategory = "service" | "rights" | "work" | "bills" | "privacy";

export interface FaqEntry {
  id: string;
  category: FaqCategory;
  q_he: string;
  a_he: string;
  q_en: string;
  a_en: string;
}

export const FAQ_CATEGORIES: { key: FaqCategory; he: string; en: string }[] = [
  { key: "service", he: "איך זכאי עובד", en: "How Zakai works" },
  { key: "rights", he: "זכויות והחזרים", en: "Rights & refunds" },
  { key: "work", he: "עבודה ושכר", en: "Work & pay" },
  { key: "bills", he: "חשבונות והוזלות", en: "Bills & savings" },
  { key: "privacy", he: "פרטיות ואבטחה", en: "Privacy & security" },
];

export const FAQ: FaqEntry[] = [
  {
    id: "fee",
    category: "service",
    q_he: "כמה זה עולה? מתי אני משלם?",
    a_he: "הבדיקה חינם. עמלה נגבית רק על חיסכון שמתועד בפועל (לפני/אחרי), ורק אם באמת חסכת. במסלול חינם העמלה 18%, ב-Pro 9%, וב-Max 0%. אין חיסכון — אין תשלום.",
    q_en: "How much does it cost? When do I pay?",
    a_en: "Checking is free. A fee is charged only on a documented saving (before/after) and only if you actually saved. Free plan is 18%, Pro 9%, Max 0%. No saving — no charge.",
  },
  {
    id: "how",
    category: "service",
    q_he: "איך זכאי עובד בעצם?",
    a_he: "מעלים חשבונית או ממלאים פרטים, זכאי מנתח ומזהה כמה אפשר לחסוך או מה מגיע לך, ומכין את הפנייה/המכתב. אתה מאשר, ורק אז פועלים. כל שקל שנחסך מתועד בהוכחה. אין צוות שמתקשר חזרה — הפעולה בתוך האפליקציה.",
    q_en: "How does Zakai actually work?",
    a_en: "You upload a bill or enter details, Zakai analyzes how much you can save or what you're owed and drafts the request/letter. You approve, and only then do we act. Every shekel saved is documented with proof. There is no call-back team — action is in-app.",
  },
  {
    id: "callback",
    category: "service",
    q_he: "מישהו יחזור אליי בטלפון?",
    a_he: "לא. אין מוקד טלפוני. זכאי נותן כלים, מכתבים ומשא ומתן בתוך האפליקציה — מיידי, בלי להמתין.",
    q_en: "Will someone call me back?",
    a_en: "No. There is no call center. Zakai gives tools, letters and negotiation inside the app — immediately, without waiting.",
  },
  {
    id: "lawyer",
    category: "service",
    q_he: "זכאי זה עורך דין או רואה חשבון?",
    a_he: "לא. זכאי הוא כלי עזר-עצמי שעוזר לך לממש זכויות ולהוזיל חשבונות, ואינו מהווה ייעוץ משפטי, מס או פיננסי. לכל שקל שנציג נצרף גם את המקור הרשמי כדי שתוכל לאמת בעצמך.",
    q_en: "Is Zakai a lawyer or accountant?",
    a_en: "No. Zakai is a self-help tool that helps you claim rights and lower bills; it is not legal, tax or financial advice. For every figure we cite the official source so you can verify it yourself.",
  },
  {
    id: "trust",
    category: "service",
    q_he: "איך אני יודע שהחיסכון אמיתי ולא מנופח?",
    a_he: "כל חיסכון נמדד מ'לפני' ל'אחרי' על סמך חשבוניות, ונשמר ביומן שרק מוסיפים אליו ולא מוחקים. יש לך 14 יום לערער על כל חיוב.",
    q_en: "How do I know the saving is real and not inflated?",
    a_en: "Every saving is measured before→after from real bills and stored in an append-only ledger. You have 14 days to dispute any charge.",
  },
  {
    id: "family",
    category: "service",
    q_he: "אפשר לבדוק גם חשבונות של ההורים?",
    a_he: "כן. בזמן הבדיקה כתוב למי היא (למשל 'אמא'), והבדיקות יופיעו מקובצות בלוח שלך. עדיף באישור בעל החשבון.",
    q_en: "Can I check my parents' bills too?",
    a_en: "Yes. When you run a check, label who it's for (e.g. 'Mom') and it groups on your dashboard. Best done with the account holder's consent.",
  },
  {
    id: "taxrefund",
    category: "rights",
    q_he: "מגיע לי החזר מס?",
    a_he: "לרוב כן אם עבדת רק חלק מהשנה, החלפת עבודות, או היו לך נקודות זיכוי לא מנוצלות. אפשר להגיש עד 6 שנים אחורה. בדוק במחשבון /taxrefund.",
    q_en: "Am I owed a tax refund?",
    a_en: "Often yes if you worked only part of the year, switched jobs, or had unused credit points. You can file up to 6 years back. Check /taxrefund.",
  },
  {
    id: "entitlements",
    category: "rights",
    q_he: "איך אני יודע מה מגיע לי בכלל?",
    a_he: "ענה על שאלון 'מה מגיע לי' (/entitlements) או מפת נזילות (/leaks).",
    q_en: "How do I even know what I'm owed?",
    a_en: "Take the 'What am I owed' quiz (/entitlements) or open the leaks map (/leaks).",
  },
  {
    id: "flight",
    category: "rights",
    q_he: "הטיסה שלי התעכבה או בוטלה — מגיע לי פיצוי?",
    a_he: "ייתכן, לפי חוק שירותי תעופה בישראל או EC261. הסוכן מכין ושולח דרישת פיצוי עם Mandate ב-/flights.",
    q_en: "My flight was delayed or cancelled — am I owed compensation?",
    a_en: "Possibly, under Israel's Aviation Services Law or EU EC261. The agent prepares and sends a compensation demand with a Mandate at /flights.",
  },
  {
    id: "payslip",
    category: "work",
    q_he: "איך אני יודע שהתלוש שלי תקין?",
    a_he: "שכר מינימום, פנסיה והבראה — בדוק ב-/payslip.",
    q_en: "How do I know my payslip is correct?",
    a_en: "Minimum wage, pension, convalescence — check /payslip.",
  },
  {
    id: "severance",
    category: "work",
    q_he: "מגיעים לי פיצויי פיטורים?",
    a_he: "בדרך כלל כן אחרי שנת עבודה — חשב ב-/severance.",
    q_en: "Am I owed severance pay?",
    a_en: "Usually after a year of work — calculate at /severance.",
  },
  {
    id: "miluim",
    category: "work",
    q_he: "שירתתי במילואים — קיבלתי את כל התגמול?",
    a_he: "רבים מפספסים תוספת 20%. בדוק ב-/miluim.",
    q_en: "I served in the reserves — did I get the full pay?",
    a_en: "Many miss the 20% supplement. Check /miluim.",
  },
  {
    id: "bill",
    category: "bills",
    q_he: "איך זכאי מוזיל לי את חשבון הסלולר/אינטרנט?",
    a_he: "הסוכן בודק ומכין פנייה מנומקת ב-/check; אתה מאשר ושולח עם Mandate. לולאת משא ומתן בדשבורד אחרי שליחה.",
    q_en: "How does Zakai lower my mobile/internet bill?",
    a_en: "The agent analyzes and drafts a reasoned request at /check; you approve and it sends with a Mandate. Negotiation loop on the dashboard after send.",
  },
  {
    id: "subs",
    category: "bills",
    q_he: "יש לי מנויים ששכחתי מהם?",
    a_he: "סריקה ב-/scan או /money, והסוכן שולח ביטול או בקשת שימור ב-/cancel עם Mandate.",
    q_en: "Do I have subscriptions I forgot about?",
    a_en: "Scan at /scan or /money, and the agent sends a cancellation or retention request at /cancel with a Mandate.",
  },
  {
    id: "parking",
    category: "bills",
    q_he: "קיבלתי דוח חניה או קנס באוטובוס — אפשר לערער?",
    a_he: "כן, ובשירות מלא: הסוכן מכין ערעור, שולח בשמך עם מסמך הרשאה, ועוקב אחרי התשובה. ב-/parking או /transport-fine.",
    q_en: "I got a parking ticket or a bus fine — can I appeal?",
    a_en: "Yes, full agent service: it drafts the appeal, sends it in your name with a Mandate, and tracks the reply. At /parking or /transport-fine.",
  },
  {
    id: "warranty",
    category: "bills",
    q_he: "מכשיר התקלקל בתוך האחריות — מה עושים?",
    a_he: "הסוכן שולח דרישה בכתב למימוש אחריות (תיקון / החלפה) עם Mandate, ועוקב אחרי התשובה. ב-/warranty.",
    q_en: "My device broke under warranty — what can I do?",
    a_en: "The agent sends a written warranty demand (repair / replacement) with a Mandate and tracks the reply. At /warranty.",
  },
  {
    id: "bank-fees",
    category: "bills",
    q_he: "עמלות הבנק שלי גבוהות — אפשר לעשות משהו?",
    a_he: "כן. הסוכן מכין ומגיש ערעור על עמלות עם Mandate, ועוקב אחרי התשובה. ב-/bank-fees.",
    q_en: "My bank fees are high — can something be done?",
    a_en: "Yes. The agent prepares and sends a fee dispute with a Mandate, and tracks the reply. At /bank-fees.",
  },
  {
    id: "electricity",
    category: "bills",
    q_he: "אפשר להוזיל את חשבון החשמל?",
    a_he: "כן — מעבר לספק פרטי נותן הנחה קבועה. הסוכן משווה, שולח בקשת מעבר, ועוקב עד לחיסכון מתועד. ב-/electricity.",
    q_en: "Can I lower my electricity bill?",
    a_en: "Yes — switching to a private supplier gives a fixed discount. The agent compares, sends the switch request, and tracks it through to a documented saving. At /electricity.",
  },
  {
    id: "refund",
    category: "bills",
    q_he: "מגיע לי החזר כספי שלא הגיע?",
    a_he: "הסוכן שולח דרישת החזר בכתב עם Mandate, ועוקב אחרי התשובה. ב-/refund-chase.",
    q_en: "I'm owed a refund that never arrived?",
    a_en: "The agent sends a written refund demand with a Mandate, and tracks the reply. At /refund-chase.",
  },
  {
    id: "late-payment",
    category: "work",
    q_he: "לקוח לא משלם לי חשבונית בזמן?",
    a_he: "עצמאי/עסק קטן: לפי חוק מוסר תשלומים לספקים (2017), מועד התשלום המרבי הוא 45 יום. אם חלף, הסוכן שולח דרישה בכתב עם Mandate. ב-/late-payment.",
    q_en: "A client isn't paying my invoice on time?",
    a_en: "Freelancer/small business: under the 2017 Fair Payment Practices law, the maximum payment term is 45 days. Once it's passed, the agent sends a written demand with a Mandate. At /late-payment.",
  },
  {
    id: "deposit",
    category: "bills",
    q_he: "עברתי דירה והמשכיר לא מחזיר לי את הפיקדון?",
    a_he: "לפי חוק, על המשכיר להשיב את הפיקדון בתוך 60 יום מהפינוי. אם חלף, הסוכן שולח דרישה בכתב עם Mandate. ב-/deposit.",
    q_en: "I moved out and my landlord isn't returning my deposit?",
    a_en: "By law the landlord must return the deposit within 60 days of vacating. Once that's passed, the agent sends a written demand with a Mandate. At /deposit.",
  },
  {
    id: "duplicate-insurance",
    category: "bills",
    q_he: "אני משלם פעמיים על אותו ביטוח שיפוי?",
    a_he: "בביטוחי שיפוי אפשר לתבוע רק פעם אחת על העלות בפועל. אם יש כפל מול שב\"ן, הסוכן שולח בקשת ביטול בכתב עם Mandate. ב-/duplicate-insurance.",
    q_en: "Am I paying twice for the same indemnity health cover?",
    a_en: "Indemnity cover only pays actual cost once. If you overlap with work/kupah cover, the agent sends a written cancellation request with a Mandate. At /duplicate-insurance.",
  },
  {
    id: "arnona",
    category: "bills",
    q_he: "אפשר להוזיל ארנונה או לתקן חיוב שגוי?",
    a_he: "הסוכן שולח בקשת הנחה או השגה בכתב לעירייה עם Mandate, ועוקב עד להחלטה בכתב. ב-/arnona.",
    q_en: "Can I lower arnona or fix a wrong charge?",
    a_en: "The agent sends a written discount or objection to the municipality with a Mandate, and tracks it through a written decision. At /arnona.",
  },
  {
    id: "data",
    category: "privacy",
    q_he: "מה קורה עם המידע שלי? זה בטוח?",
    a_he: "אפס טראקרים, תעבורה מוצפנת, סריקות בדפדפן כשאפשר, מחיקת חשבון בקליק.",
    q_en: "What happens to my data? Is it safe?",
    a_en: "Zero trackers, encrypted traffic, browser-side scans where possible, one-click account deletion.",
  },
  {
    id: "poa",
    category: "privacy",
    q_he: "אני נותן לזכאי ייפוי כוח? מה זה אומר?",
    a_he: "רק כשאתה מאשר בדיקה מסוימת — מסמך הרשאה עם קוד לאימות, מוגבל, וניתן לביטול.",
    q_en: "Am I giving Zakai power of attorney? What does that mean?",
    a_en: "Only when you approve a specific check — an authorization document with a verifiable code, limited, and revocable.",
  },
];

export function faqDigest(): string {
  const lines = FAQ.map((e) => `- Q: ${e.q_he}\n  A: ${e.a_he}`).join("\n");
  return `VETTED FAQ (align answers to these):\n${lines}\n\n${agentPlaybookBlock()}`;
}
