/**
 * Multi-round consumer negotiation playbooks.
 * Designed for a solo/AI-only product: the user copies and sends; no call center.
 */

export type ProviderReplyKind =
  | "refused"
  | "too_low"
  | "delay"
  | "asked_call"
  | "accepted"
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
}

export interface FollowUpResult {
  subject: string;
  body: string;
  tip: string;
  nextIfNoReply: string;
}

/**
 * Deterministic Hebrew follow-ups. Always disclose Zakai is a digital agent.
 * Never promise outcomes. Push for written retention offers.
 */
export function buildFollowUp(input: FollowUpInput): FollowUpResult {
  const name = input.customerName.trim() || "הלקוח/ה";
  const provider = input.providerLabel;
  const current = input.amountOriginalShekels;
  const target = input.targetShekels;
  const mid = Math.round((current + target) / 2);
  const plan = input.plan?.trim() ? ` (מסלול: ${input.plan.trim()})` : "";
  const round = input.round ?? 2;

  const baseClose = `\n\nמצורף/קיים מסמך הרשאה מטעם הלקוח/ה. אודה למענה בכתב עם ההצעה המדויקת.\n\nבברכה,\nזכאי — סוכן דיגיטלי בשם ${name}`;

  switch (input.replyKind) {
    case "refused":
      return {
        subject: `המשך פנייה — התאמת מחיר ללקוח קיים | ${name}`,
        tip: "כשאומרים לא — מבקשים נימוק בכתב + הצעת שימור. לא מתמקחים בטלפון בלי סיכום כתוב.",
        nextIfNoReply: "אם אין מענה תוך 5–7 ימי עסקים — שלחו תזכורת קצרה (כפתור תזכורת).",
        body: `לכבוד שירות הלקוחות של ${provider},

פנייה חוזרת (סיבוב ${round}) מטעם ${name}, באמצעות זכאי — סוכן דיגיטלי מורשה. אינני הלקוח/ה עצמו/ה.

התקבלה תשובה שאינה מאפשרת התאמת מחיר. מבקשים:
1. נימוק קצר בכתב מדוע לא ניתן מסלול שימור ללקוח קיים שמשלם כ-₪${current} בחודש${plan}.
2. פירוט חלופות קיימות (הורדת מסלול / הטבת נאמנות / התחייבות לתקופה) בכיוון של כ-₪${target}–₪${mid} לחודש.
3. אישור שאין חיובים נלווים שאינם הכרחיים לשימוש.

המטרה היא הסכמה שקופה בכתב — לא ויכוח טלפוני.${baseClose}`,
      };

    case "too_low":
      return {
        subject: `בקשה לשיפור הצעה | ${name}`,
        tip: "מודים על ההצעה, מבקשים גישור בין המחיר הנוכחי ליעד — לא דחייה גסה.",
        nextIfNoReply: "אם ההצעה הסופית עדיין גבוהה — אפשר לרשום את הסכום החדש כחיסכון חלקי.",
        body: `לכבוד ${provider},

תודה על ההצעה. מטעם ${name} (באמצעות זכאי — סוכן דיגיטלי) מבקשים לשפר אותה.

החיוב הנוכחי כ-₪${current} לחודש${plan}. היעד הסביר מצד הלקוח/ה הוא כ-₪${target} לחודש; אם אין אפשרות מלאה — נשמח להצעה משופרת סביב ₪${mid}, עם פירוט מה כלול.

נא מענה בכתב בלבד.${baseClose}`,
      };

    case "delay":
      return {
        subject: `תזכורת — פנייה ממתינה למענה | ${name}`,
        tip: "תזכורת קצרה, מנומסת, עם תאריך יעד למענה.",
        nextIfNoReply: "עוד תזכורת אחת אחרי שבוע, ואז שקלו מעבר ספק אם רלוונטי.",
        body: `לכבוד ${provider},

תזכורת מטעם ${name} באמצעות זכאי. הפנייה הקודמת לגבי התאמת מחיר (כ-₪${current} → יעד כ-₪${target}) ממתינה למענה.

נא לעדכן בכתב תוך 5 ימי עסקים האם קיימת הצעת שימור, ואיזו.${baseClose}`,
      };

    case "asked_call":
      return {
        subject: `בקשה להצעה בכתב | ${name}`,
        tip: "לא נכנסים לשיחה בלי סיכום כתוב — זה שומר על התיעוד ועל העמלה.",
        nextIfNoReply: "חזרו על בקשת הכתב. אם מתעקשים על שיחה — הלקוח מדבר, ואז מעדכן בזכאי את התוצאה.",
        body: `לכבוד ${provider},

מטעם ${name} (זכאי — סוכן דיגיטלי): נשמח לקבל את הצעת השימור בכתב (מייל/צ׳אט/מסרון רשמי), כולל מחיר חודשי סופי ותנאי התחייבות אם יש.

הלקוח/ה זמין/ה לשיחה במידת הצורך לאחר קבלת ההצעה הכתובה.${baseClose}`,
      };

    case "accepted":
      return {
        subject: `אישור הבנה — נא אישור כתוב | ${name}`,
        tip: "מבקשים אישור כתוב של המחיר החדש, ואז רושמים חיסכון בזכאי.",
        nextIfNoReply: "אחרי האישור — הזינו בזכאי את הסכום החדש תחת תיק זה.",
        body: `לכבוד ${provider},

תודה. מטעם ${name} מבקשים אישור כתוב של המחיר החודשי החדש ותאריך תחילה, כדי לוודא שההסכמה מיושמת בפועל.${baseClose}`,
      };

    default:
      return {
        subject: `המשך טיפול בפנייה | ${name}`,
        tip: "שמרו הכול בכתב. עדכנו בזכאי כל הצעה חדשה.",
        nextIfNoReply: "תזכורת אחרי כמה ימי עסקים.",
        body: `לכבוד ${provider},

המשך פנייה מטעם ${name} באמצעות זכאי — סוכן דיגיטלי. נשמח למענה מסודר בכתב לגבי התאמת החיוב החודשי (כיום כ-₪${current}${plan}, יעד כ-₪${target}).${baseClose}`,
      };
  }
}

export const REPLY_KIND_OPTIONS: { id: ProviderReplyKind; he: string; en: string }[] = [
  { id: "refused", he: "סירבו / אין הנחה", en: "Refused / no discount" },
  { id: "too_low", he: "הציעו מעט מדי", en: "Offer too low" },
  { id: "delay", he: "לא ענו / סחבו", en: "No reply / delay" },
  { id: "asked_call", he: "ביקשו רק טלפון", en: "Asked for a call only" },
  { id: "accepted", he: "הסכימו — צריך אישור כתוב", en: "Agreed — need written confirm" },
  { id: "other", he: "אחר", en: "Other" },
];
