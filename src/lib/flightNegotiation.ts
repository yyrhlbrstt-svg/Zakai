import { buildPromiseBrokenFollowUp, type FollowUpInput, type FollowUpResult } from "./negotiation";

/** Written follow-ups for airline compensation — not telecom retention language. */
export function buildAirlineFollowUp(input: FollowUpInput): FollowUpResult {
  const name = input.customerName.trim() || "הלקוח/ה";
  const airline = input.providerLabel;
  const round = input.round ?? 2;
  const days = round <= 2 ? 14 : 7;

  const baseClose = `\n\nמצורף/קיים מסמך הרשאה מטעם הנוסע/ת עם אפשרות אימות. אודה למענה בכתב בלבד.\n\nבברכה,\nזכאי — סוכן דיגיטלי בשם ${name}`;

  switch (input.replyKind) {
    case "accepted":
      return {
        subject: `אישור פיצוי טיסה | ${name}`,
        tip: "בקשו אישור בכתב עם סכום ומועד תשלום לפני שמסמנים הצלחה בדשבורד.",
        nextIfNoReply: "אם לא שולמים במועד — פנייה נוספת בכתב.",
        body: `לכבוד שירות הלקוחות של ${airline},

תודה על האישור. נא לאשר בכתב את סכום הפיצוי/הזיכוי, מועד התשלום, ואמצעי התשלום (העברה / זיכוי כרטיס).

זוהי פניית מעקב (סיבוב ${round}) מטעם ${name} באמצעות זכאי — סוכן דיגיטלי מורשה.${baseClose}`,
      };
    case "refused":
      return {
        subject: `המשך דרישת פיצוי טיסה | ${name}`,
        tip: "סירוב — בקשו נימוק בכתב והפניה לנהלים פנימיים.",
        nextIfNoReply: "שקלו תלונה לרשות התעופה / גורם מפקח לפי תחום השיפוט.",
        body: `לכבוד שירות הלקוחות של ${airline},

פנייה חוזרת (סיבוב ${round}) מטעם ${name} באמצעות זכאי.

התקבלה תשובה שאינה מכירה בזכאות לפיצוי. מבקשים בכתב:
1. נימוק משפטי/נהלי מפורט לסירוב.
2. הפניה לתנאי הכרטיס/החוזה שעליהם הסתמכתם.
3. אישור שקיבלתם את דרישת הפיצוי המקורית.

נודה למענה תוך ${days} ימים.${baseClose}`,
      };
    // Compensation they agreed to and never paid. Falling through to the
    // reminder below would ask again for something already conceded.
    case "promise_broken":
      return buildPromiseBrokenFollowUp(input);

    default:
      return {
        subject: `תזכורת — דרישת פיצוי טיסה | ${name}`,
        tip: "שתיקה — תזכורת עם דדליין בכתב.",
        nextIfNoReply: "סיבוב נוסף, ואז שקלו גורם מפקח.",
        body: `לכבוד שירות הלקוחות של ${airline},

פניית מעקב (סיבוב ${round}) מטעם ${name} באמצעות זכאי — סוכן דיגיטלי מורשה.

טרם התקבל מענה מסודר לדרישת הפיצוי שנשלחה. נא לאשר קבלה ולספק תשובה בכתב תוך ${days} ימים, כולל סכום מוצע או נימוק לסירוב.

הנוסע/ת ממתין/ה לסיום בכתב בלבד.${baseClose}`,
      };
  }
}
