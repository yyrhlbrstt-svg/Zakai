/**
 * Multi-round consumer negotiation playbooks.
 * Solo / AI-only product: user copies and sends; no call center.
 * Escalation stays written, documented, and success-fee friendly.
 */

export type ProviderReplyKind =
  | "refused"
  | "too_low"
  | "delay"
  | "asked_call"
  | "accepted"
  | "competitor"
  | "other";

export interface FollowUpInput {
  customerName: string;
  providerLabel: string;
  amountOriginalShekels: number;
  targetShekels: number;
  plan?: string;
  replyKind: ProviderReplyKind;
  /** Round number starting at 2 (first outreach already sent). */
  round?: number;
  competitorName?: string;
  competitorPriceShekels?: number;
}

export interface FollowUpResult {
  subject: string;
  body: string;
  tip: string;
  nextIfNoReply: string;
}

export function buildFollowUp(input: FollowUpInput): FollowUpResult {
  const name = input.customerName.trim() || "הלקוח/ה";
  const provider = input.providerLabel;
  const current = input.amountOriginalShekels;
  const target = input.targetShekels;
  const mid = Math.round((current + target) / 2);
  const plan = input.plan?.trim() ? ` (מסלול: ${input.plan.trim()})` : "";
  const round = input.round ?? 2;

  const baseClose = `\n\nמצורף/קיים מסמך הרשאה מטעם הלקוח/ה עם אפשרות אימות. אודה למענה בכתב עם הצעה מדויקת (מחיר חודשי + תנאים).\n\nבברכה,\nזכאי — סוכן דיגיטלי בשם ${name}`;

  switch (input.replyKind) {
    case "refused":
      return {
        subject: `המשך פנייה — שימור לקוח קיים | ${name}`,
        tip: "כשאומרים לא — מבקשים נימוק בכתב + חלופות. לא נכנסים לוויכוח טלפוני בלי סיכום.",
        nextIfNoReply: "תזכורת אחרי 5–7 ימי עסקים, ואז שקלו מתחרה / ביטול חלקי.",
        body: `לכבוד שירות הלקוחות של ${provider},

פנייה חוזרת (סיבוב ${round}) מטעם ${name}, באמצעות זכאי — סוכן דיגיטלי מורשה. אינני הלקוח/ה עצמו/ה.

התקבלה תשובה שאינה מאפשרת התאמת מחיר. מבקשים בכתב:
1. נימוק קצר מדוע לא ניתן מסלול שימור ללקוח קיים שמשלם כ-₪${current} בחודש${plan}.
2. חלופות: הורדת מסלול / הטבת נאמנות / התחייבות קצרה — בכיוון ₪${target}–₪${mid} לחודש.
3. פירוט חיובים נלווים שאינם הכרחיים לשימוש בפועל.

המטרה: הסכמה שקופה בכתב.${baseClose}`,
      };

    case "too_low":
      return {
        subject: `בקשה לשיפור הצעה | ${name}`,
        tip: "מודים, מבקשים גישור — לא דחייה גסה. כל שקל ירידה = חיסכון מתועד.",
        nextIfNoReply: "אם ההצעה הסופית עדיין גבוהה — רשמו חיסכון חלקי בזכאי.",
        body: `לכבוד ${provider},

תודה על ההצעה. מטעם ${name} (באמצעות זכאי — סוכן דיגיטלי) מבקשים לשפר אותה.

החיוב הנוכחי כ-₪${current} לחודש${plan}. היעד מצד הלקוח/ה כ-₪${target}; אם אין אפשרות מלאה — הצעה משופרת סביב ₪${mid} עם פירוט מה כלול.

נא מענה בכתב בלבד.${baseClose}`,
      };

    case "delay":
      return {
        subject: `תזכורת — פנייה ממתינה | ${name}`,
        tip: "תזכורת קצרה + תאריך יעד. שומרים על טון ענייני.",
        nextIfNoReply: "עוד תזכורת אחת, ואז מתחרה או הורדת מסלול.",
        body: `לכבוד ${provider},

תזכורת מטעם ${name} באמצעות זכאי. הפנייה לגבי התאמת מחיר (כ-₪${current} → יעד כ-₪${target}) ממתינה למענה.

נא עדכון בכתב תוך 5 ימי עסקים.${baseClose}`,
      };

    case "asked_call":
      return {
        subject: `בקשה להצעה בכתב | ${name}`,
        tip: "כתב לפני שיחה — זה התיעוד שמצדיק עמלה רק על הצלחה.",
        nextIfNoReply: "חזרו על בקשת הכתב. אם חייבים שיחה — הלקוח מדבר ומעדכן בזכאי.",
        body: `לכבוד ${provider},

מטעם ${name} (זכאי — סוכן דיגיטלי): נשמח להצעת שימור בכתב (מייל/צ׳אט רשמי) — מחיר חודשי סופי ותנאי התחייבות אם יש.

הלקוח/ה זמין/ה לשיחה לאחר קבלת ההצעה הכתובה.${baseClose}`,
      };

    case "competitor": {
      const cName = input.competitorName?.trim() || "מתחרה";
      const cPrice =
        input.competitorPriceShekels && input.competitorPriceShekels > 0
          ? `כ-₪${Math.round(input.competitorPriceShekels)} לחודש`
          : "מחיר נמוך יותר";
      return {
        subject: `השוואת הצעות — בקשת שימור | ${name}`,
        tip: "מציגים אלטרנטיבה בלי איום גס — מבקשים התאמה לשימור.",
        nextIfNoReply: "אם אין שימור — הלקוח יכול לעבור; תעדו בזכאי מה שקרה.",
        body: `לכבוד ${provider},

מטעם ${name} באמצעות זכאי. הלקוח/ה בוחן/ת גם הצעה מ${cName} (${cPrice}).

לפני החלטה — מבקשים הצעת שימור תחרותית בכתב מול החיוב הנוכחי כ-₪${current}${plan}, בכיוון כ-₪${target}.

נא מענה מנומק בכתב.${baseClose}`,
      };
    }

    case "accepted":
      return {
        subject: `אישור כתוב נדרש | ${name}`,
        tip: "בלי אישור כתוב של המחיר החדש — לא סוגרים חיסכון בזכאי.",
        nextIfNoReply: "אחרי האישור — הזינו סכום חדש בדשבורד.",
        body: `לכבוד ${provider},

תודה. מטעם ${name} מבקשים אישור כתוב: מחיר חודשי חדש, מה כלול, ותאריך תחילה.${baseClose}`,
      };

    default:
      return {
        subject: `המשך טיפול | ${name}`,
        tip: "הכול בכתב. כל הצעה חדשה נכנסת לזכאי.",
        nextIfNoReply: "תזכורת אחרי כמה ימי עסקים.",
        body: `לכבוד ${provider},

המשך פנייה מטעם ${name} באמצעות זכאי. נשמח למענה בכתב על התאמת חיוב (כ-₪${current}${plan} → יעד כ-₪${target}).${baseClose}`,
      };
  }
}

export const REPLY_KIND_OPTIONS: { id: ProviderReplyKind; he: string; en: string }[] = [
  { id: "refused", he: "סירבו / אין הנחה", en: "Refused / no discount" },
  { id: "too_low", he: "הציעו מעט מדי", en: "Offer too low" },
  { id: "delay", he: "לא ענו / סחבו", en: "No reply / delay" },
  { id: "asked_call", he: "ביקשו רק טלפון", en: "Asked for a call only" },
  { id: "competitor", he: "יש הצעת מתחרה", en: "Have a competitor offer" },
  { id: "accepted", he: "הסכימו — צריך אישור כתוב", en: "Agreed — need written confirm" },
  { id: "other", he: "אחר", en: "Other" },
];
