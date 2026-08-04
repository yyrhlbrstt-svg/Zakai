import type { FollowUpInput, FollowUpResult } from "./negotiation";

/**
 * Follow-ups for lump recoveries (refunds, deposits, fees, cancel confirmations)
 * — not monthly telecom retention language.
 */
export function buildLumpFollowUp(input: FollowUpInput): FollowUpResult {
  const name = input.customerName.trim() || "הלקוח/ה";
  const provider = input.providerLabel;
  const owed = input.amountOriginalShekels;
  const target = input.targetShekels;
  const round = input.round ?? 2;
  const days = round <= 2 ? 7 : round === 3 ? 5 : 3;
  const plan = input.plan?.trim() ? ` (${input.plan.trim()})` : "";

  const baseClose = `\n\nמצורף/קיים מסמך הרשאה מטעם הלקוח/ה עם אפשרות אימות. אודה למענה בכתב בלבד.\n\nבברכה,\nזכאי — סוכן דיגיטלי בשם ${name}`;

  switch (input.replyKind) {
    case "accepted":
      return {
        subject: `אישור כתוב נדרש — החזר/סיום | ${name}`,
        tip: "בלי אישור כתוב של הסכום והמועד — לא סוגרים החזר בזכאי.",
        nextIfNoReply: "אחרי האישור — הזינו ₪0 נותר או סכום שנותר בדשבורד.",
        body: `לכבוד ${provider},

תודה. מטעם ${name} (באמצעות זכאי) מבקשים אישור כתוב: סכום ההחזר/הזיכוי, מועד ביצוע, ואמצעי תשלום.${baseClose}`,
      };

    case "refused":
      return {
        subject: `המשך דרישה בכתב | ${name}`,
        tip: "סירוב — מבקשים נימוק בכתב, לא ויכוח טלפוני.",
        nextIfNoReply: "סיבוב נוסף או תלונה לגורם מפקח לפי התחום.",
        body: `לכבוד ${provider},

פנייה חוזרת (סיבוב ${round}) מטעם ${name} באמצעות זכאי — סוכן דיגיטלי מורשה.

התקבלה תשובה שאינה מכירה בדרישה${plan}. מבקשים בכתב:
1. נימוק מפורט לסירוב.
2. הפניה לתנאים/חוזה שעליהם הסתמכתם.
3. אישור שקיבלתם את הפנייה המקורית (סכום כ-₪${owed}).

נודה למענה תוך ${days} ימי עסקים.${baseClose}`,
      };

    case "too_low":
      return {
        subject: `בקשה לשיפור סכום החזר | ${name}`,
        tip: "מודים ומבקשים גישור לסכום המלא — כל שקל מתועד.",
        nextIfNoReply: "אם ההצעה הסופית חלקית — רשמו החזר חלקי בזכאי.",
        body: `לכבוד ${provider},

תודה על ההצעה. מטעם ${name} (זכאי) מבקשים לשפר את סכום ההחזר/הזיכוי.

הדרישה המקורית כ-₪${owed}${plan}. היעד מצד הלקוח/ה כ-₪${target} (או מלוא הסכום אם רלוונטי).

נא מענה בכתב תוך ${days} ימי עסקים.${baseClose}`,
      };

    case "asked_call":
      return {
        subject: `בקשה למענה בכתב | ${name}`,
        tip: "כתב לפני שיחה — זה התיעוד שמצדיק עמלה על הצלחה.",
        nextIfNoReply: "חזרו על בקשת הכתב.",
        body: `לכבוד ${provider},

מטעם ${name} (זכאי — סוכן דיגיטלי): נשמח למענה בכתב בלבד לגבי הדרישה (כ-₪${owed})${plan} — לפני כל שיחה.

הלקוח/ה זמין/ה לשיחה לאחר קבלת עמדה כתובה.${baseClose}`,
      };

    case "delay":
    default:
      return {
        subject: `תזכורת — דרישה ממתינה | ${name}`,
        tip: "תזכורת קצרה + דדליין. טון ענייני.",
        nextIfNoReply:
          round >= 3 ? "עוד תזכורת אחת, ואז גורם מפקח / ביטול המשך." : "תזכורת נוספת אחרי כמה ימים.",
        body: `לכבוד ${provider},

תזכורת (סיבוב ${round}) מטעם ${name} באמצעות זכאי. הפנייה לגבי החזר/סיום חיוב (כ-₪${owed}${plan}) ממתינה למענה.

נא עדכון בכתב תוך ${days} ימי עסקים.${round >= 3 ? " זו תזכורת ממוקדת לפני בחינת צעדים נוספים." : ""}${baseClose}`,
      };
  }
}
