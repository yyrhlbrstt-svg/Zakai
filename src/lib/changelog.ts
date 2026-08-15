/**
 * What actually shipped, in the order it shipped.
 *
 * Written by hand rather than generated from git, on purpose. A commit log is
 * a record of work; a changelog is a promise about what a person can now do,
 * and most commits do not change that. Anything that would make a reader
 * expect a capability that is not there does not belong here — including
 * anything only half-configured in production, which belongs on /status.
 *
 * Dates are the date the change reached the branch, ISO, so ordering is
 * unambiguous across locales.
 */

export interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  he: string;
  en: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-08-12",
    he: "כספת קופונים למנויי Pro ומעלה — כל קוד הנחה שלך במקום אחד, לפי קטגוריה, עם חיפוש, העתקה בלחיצה, והתראה שבועיים לפני תפוגה.",
    en: "Coupon vault for Pro and above — every discount code in one place, by category, with search, one-click copy, and a warning two weeks before expiry.",
  },
  {
    date: "2026-08-12",
    he: "מסך «מה נעשה בשמי» — כל פעולה שנעשתה בשמך, תחת איזו הרשאה, ומה יצא בפועל ומה עדיין ממתין. אפשר לבטל הרשאה מתוך הרשימה.",
    en: "A “what was done in my name” screen — every action taken for you, under which authority, what actually left and what is still waiting. Authorities can be revoked from the list.",
  },
  {
    date: "2026-08-12",
    he: "ייצוא נתוני חשבון — הורדה של כל מה שאנחנו מחזיקים עליך, כולל נוסח המכתבים המלא.",
    en: "Account data export — download everything we hold about you, including the full text of every letter.",
  },
  {
    date: "2026-08-12",
    he: "דף סטטוס ציבורי, דף «צור קשר», ודף השינויים הזה.",
    en: "A public status page, a contact page, and this changelog.",
  },
  {
    date: "2026-08-09",
    he: "מרשם ההתחייבויות — כל חוזה מתחדש במקום אחד, עם התאריך שבו צריך להודיע, לא התאריך שבו הוא מתחדש.",
    en: "The commitments record — every renewing contract in one place, showing the date notice is due rather than the date it renews.",
  },
  {
    date: "2026-08-09",
    he: "שמונה תחומים חדשים קיבלו מסלול תביעה מלא: כבודה, כביש אגרה, מים, אגרת רישוי רכב, עיכוב רכבת, תיקונים בשכירות, ועד בית, ותלונה על חברת גבייה.",
    en: "Eight more verticals got a full claim path: baggage, toll disputes, water bills, vehicle licence refunds, train delays, landlord repairs, building committees, and debt-collector complaints.",
  },
  {
    date: "2026-08-08",
    he: "תיקון: דף המחירים המליץ על Max גם כשה-Pro היה זול יותר עבור אותו חיסכון.",
    en: "Fix: the pricing page recommended Max even when Pro was cheaper for the same saving.",
  },
  {
    date: "2026-08-08",
    he: "מעקב אחרי זיכוי שהובטח — אם ספק אמר שיזכה אותך, אנחנו בודקים אם הכסף באמת הגיע, ומייצרים מכתב המשך אם לא.",
    en: "Promised-credit tracking — when a provider says it will credit you, we check whether the money actually arrived, and produce a follow-up letter if it did not.",
  },
  {
    date: "2026-08-08",
    he: "תיקון: תזכורת החוזה הצביעה על תאריך החידוש במקום על התאריך האחרון שאפשר להודיע בו — כלומר הגיעה כשכבר היה מאוחר.",
    en: "Fix: the contract reminder pointed at the renewal date instead of the last date notice could still be given — that is, it arrived once it was already too late.",
  },
];
