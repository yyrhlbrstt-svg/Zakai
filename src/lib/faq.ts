/**
 * The canonical FAQ knowledge base — a single, curated, vetted source of truth
 * for the questions Zakai users actually ask. It powers TWO things:
 *
 *   1. The public /faq page (browsable "שאלות נפוצות").
 *   2. The in-app assistant, which is told to align with these vetted answers
 *      (see faqDigest() → wired into ASSISTANT_SYSTEM in ai.ts).
 *
 * This is the honest "the agent keeps improving" mechanism: instead of letting
 * the model learn freely from chats (which drifts and is unsafe for a money
 * app), we grow THIS list from real questions with correct answers, and both
 * the FAQ and the assistant get smarter — controlled, consistent, never wrong.
 *
 * Every answer that states a right or a number names the authoritative Israeli
 * source, matching the assistant's sourcing rule.
 */
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
    a_he: "מעלים חשבונית או ממלאים פרטים, זכאי מנתח ומזהה כמה אפשר לחסוך או מה מגיע לך, ומכין את הפנייה/המכתב. אתה מאשר, ורק אז פועלים. כל שקל שנחסך מתועד בהוכחה.",
    q_en: "How does Zakai actually work?",
    a_en: "You upload a bill or enter details, Zakai analyzes how much you can save or what you're owed and drafts the request/letter. You approve, and only then do we act. Every shekel saved is documented with proof.",
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
    a_he: "כל חיסכון נמדד מ'לפני' ל'אחרי' על סמך חשבוניות, ונשמר ביומן שרק מוסיפים אליו ולא מוחקים. יש לך 14 יום לערער על כל חיוב. אפשר לראות את המנגנון בעמוד התוצאות.",
    q_en: "How do I know the saving is real and not inflated?",
    a_en: "Every saving is measured before→after from real bills and stored in an append-only ledger. You have 14 days to dispute any charge. You can see the mechanism on the results page.",
  },
  {
    id: "family",
    category: "service",
    q_he: "אפשר לבדוק גם חשבונות של ההורים?",
    a_he: "כן. בזמן הבדיקה כתוב למי היא (למשל 'אמא'), והבדיקות יופיעו מקובצות בלוח שלך. חשבון אחד יכול לנהל את כל המשפחה. עדיף באישור בעל החשבון.",
    q_en: "Can I check my parents' bills too?",
    a_en: "Yes. When you run a check, label who it's for (e.g. 'Mom') and it groups on your dashboard. One account can handle the whole family. Best done with the account holder's consent.",
  },
  {
    id: "taxrefund",
    category: "rights",
    q_he: "מגיע לי החזר מס?",
    a_he: "לרוב כן אם עבדת רק חלק מהשנה, החלפת עבודות, או היו לך נקודות זיכוי לא מנוצלות. אפשר להגיש עד 6 שנים אחורה. בדוק במחשבון /taxrefund, ואמת ברשות המסים (gov.il).",
    q_en: "Am I owed a tax refund?",
    a_en: "Often yes if you worked only part of the year, switched jobs, or had unused credit points. You can file up to 6 years back. Check /taxrefund and verify with the Tax Authority (gov.il).",
  },
  {
    id: "entitlements",
    category: "rights",
    q_he: "איך אני יודע מה מגיע לי בכלל?",
    a_he: "ענה על שאלון 'מה מגיע לי' (/entitlements) — לפי המצב שלך זכאי מציג זכויות רלוונטיות מתוך 55 (מס, ביטוח לאומי, ארנונה, משפחה, עולים, חיילים). לאימות: כל-זכות (kolzchut.org.il).",
    q_en: "How do I even know what I'm owed?",
    a_en: "Take the 'What am I owed' quiz (/entitlements) — based on your situation Zakai shows relevant rights out of 55 (tax, national insurance, arnona, family, olim, soldiers). Verify at Kol-Zchut (kolzchut.org.il).",
  },
  {
    id: "flight",
    category: "rights",
    q_he: "הטיסה שלי התעכבה או בוטלה — מגיע לי פיצוי?",
    a_he: "ייתכן. חוק שירותי תעופה בישראל וגם EC261 האירופי מזכים בפיצוי של עד מאות אירו על עיכוב/ביטול משמעותי. בדוק ב-/flights לפי פרטי הטיסה.",
    q_en: "My flight was delayed or cancelled — am I owed compensation?",
    a_en: "Possibly. Israel's Aviation Services Law and the EU's EC261 grant up to hundreds of euros for significant delays/cancellations. Check /flights with your flight details.",
  },
  {
    id: "payslip",
    category: "work",
    q_he: "איך אני יודע שהתלוש שלי תקין?",
    a_he: "שלושת הסעיפים שהכי מפספסים: שכר מינימום (₪6,443.85 לחודש ב-2026), פנסיה (מעסיק 12.5%, עובד 6%) והבראה (₪451.5 ליום בסקטור הפרטי). בדוק ב-/payslip; מקור: משרד העבודה / כל-זכות.",
    q_en: "How do I know my payslip is correct?",
    a_en: "The three most-missed items: minimum wage (₪6,443.85/month in 2026), pension (employer 12.5%, employee 6%), and convalescence pay (₪451.5/day, private sector). Check /payslip; source: Ministry of Labor / Kol-Zchut.",
  },
  {
    id: "severance",
    category: "work",
    q_he: "מגיעים לי פיצויי פיטורים?",
    a_he: "בדרך כלל כן אחרי שנת עבודה — כחודש שכר אחרון לכל שנה. גם בהתפטרות בנסיבות מסוימות. חשב ב-/severance; מקור: משרד העבודה / כל-זכות.",
    q_en: "Am I owed severance pay?",
    a_en: "Usually yes after a year of work — about one month's last salary per year. Sometimes on resignation in specific circumstances too. Calculate at /severance; source: Ministry of Labor / Kol-Zchut.",
  },
  {
    id: "miluim",
    category: "work",
    q_he: "שירתתי במילואים — קיבלתי את כל התגמול?",
    a_he: "הרבה חישובים מפספסים את תוספת ה-20% שכמעט אף אחד לא מכיר. בדוק כמה מגיע ב-/miluim; מקור: הביטוח הלאומי (btl.gov.il).",
    q_en: "I served in the reserves — did I get the full pay?",
    a_en: "Many calculations miss the 20% supplement almost nobody knows about. Check what you're owed at /miluim; source: National Insurance (btl.gov.il).",
  },
  {
    id: "bill",
    category: "bills",
    q_he: "איך זכאי מוזיל לי את חשבון הסלולר/אינטרנט?",
    a_he: "זכאי בודק מול השימוש שלך ומכין פנייה מנומקת לספק (מסלול שימור/הורדת מסלול). אתה מאשר לפני שנשלח. אין הבטחה לתוצאה — אבל אצל רוב האנשים יש מרווח להוזלה.",
    q_en: "How does Zakai lower my mobile/internet bill?",
    a_en: "Zakai checks against your usage and drafts a reasoned request to the provider (retention/downgrade). You approve before anything is sent. No outcome is promised — but most people have room to save.",
  },
  {
    id: "subs",
    category: "bills",
    q_he: "יש לי מנויים ששכחתי מהם?",
    a_he: "סביר. סריקת דף חשבון (/scan) מזהה חיובים חוזרים, כפולים או נשכחים שאפשר לבטל. הרבה משפחות מגלות מאות שקלים בשנה על מנויים לא בשימוש.",
    q_en: "Do I have subscriptions I forgot about?",
    a_en: "Likely. A statement scan (/scan) finds recurring, duplicate or forgotten charges you can cancel. Many families discover hundreds of shekels a year on unused subscriptions.",
  },
  {
    id: "parking",
    category: "bills",
    q_he: "קיבלתי דוח חניה או קנס באוטובוס — אפשר לערער?",
    a_he: "כן. זכאי מכין לך מכתב ערעור מנוסח שאתה שולח בעצמך בשמך (/parking או /transport-fine). זה כלי עזר-עצמי — ההחלטה והשליחה שלך.",
    q_en: "I got a parking ticket or a bus fine — can I appeal?",
    a_en: "Yes. Zakai drafts an appeal letter you send yourself, in your own name (/parking or /transport-fine). It's a self-help tool — the decision and the sending are yours.",
  },
  {
    id: "data",
    category: "privacy",
    q_he: "מה קורה עם המידע שלי? זה בטוח?",
    a_he: "אפס טראקרים, תעבורה מוצפנת, וסריקות שרצות בדפדפן במידת האפשר. אתה יכול למחוק את החשבון וכל הנתונים בקליק. אנחנו שומרים רק מה שנחוץ לבדיקה.",
    q_en: "What happens to my data? Is it safe?",
    a_en: "Zero trackers, encrypted traffic, and scans that run in your browser where possible. You can delete your account and all data in one click. We keep only what a check needs.",
  },
  {
    id: "poa",
    category: "privacy",
    q_he: "אני נותן לזכאי ייפוי כוח? מה זה אומר?",
    a_he: "רק כשאתה מאשר בדיקה מסוימת, נוצר מסמך הרשאה עם קוד שהספק יכול לאמת בדף ציבורי. ההרשאה מוגבלת לאותה פנייה, ואתה יכול לבטל אותה בכל רגע.",
    q_en: "Am I giving Zakai power of attorney? What does that mean?",
    a_en: "Only when you approve a specific check, an authorization document is created with a code the provider can verify on a public page. It's limited to that request, and you can revoke it anytime.",
  },
];

/**
 * A compact, vetted Q&A digest for the assistant's system prompt. Keeps the
 * agent's answers to common questions consistent with the public FAQ — the
 * controlled "keeps improving" loop. Hebrew (the assistant answers in the
 * user's language regardless, but the canonical phrasing is Hebrew).
 */
export function faqDigest(): string {
  const lines = FAQ.map((e) => `- Q: ${e.q_he}\n  A: ${e.a_he}`).join("\n");
  return `VETTED FAQ (align your answers to these curated, correct answers for common questions — they are the source of truth; if a user's question matches one, answer consistently with it):\n${lines}`;
}
