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
    a_he: "ייתכן. חוק שירותי תעופה בישראל וגם EC261. בדוק ב-/flights.",
    q_en: "My flight was delayed or cancelled — am I owed compensation?",
    a_en: "Possibly. Israel's Aviation Services Law and EU EC261. Check /flights.",
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
    a_he: "בודק ומכין פנייה מנומקת; אתה מאשר. לולאת משא ומתן בדשבורד אחרי שליחה.",
    q_en: "How does Zakai lower my mobile/internet bill?",
    a_en: "Analyzes and drafts a reasoned request; you approve. Negotiation loop on the dashboard after send.",
  },
  {
    id: "subs",
    category: "bills",
    q_he: "יש לי מנויים ששכחתי מהם?",
    a_he: "סריקה ב-/scan או /money, וביטול מיידי ב-/cancel.",
    q_en: "Do I have subscriptions I forgot about?",
    a_en: "Scan at /scan or /money, cancel at /cancel.",
  },
  {
    id: "parking",
    category: "bills",
    q_he: "קיבלתי דוח חניה או קנס באוטובוס — אפשר לערער?",
    a_he: "כן. מכתב ערעור ב-/parking או /transport-fine.",
    q_en: "I got a parking ticket or a bus fine — can I appeal?",
    a_en: "Yes. Appeal letter at /parking or /transport-fine.",
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
