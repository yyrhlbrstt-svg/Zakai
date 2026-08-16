import { z } from "zod";
import { handleReasonBasedCasePost } from "@/lib/services/reasonBasedCaseIntake";
import { resolveTransportContactEmail } from "@/lib/utilityContacts";

const REASON_BODY: Record<string, string> = {
  validator: "ניסיתי לתקף / לרכוש כרטיס אך המאמת/האפליקציה לא פעלו.",
  balance: "היה יתרה בכרטיס/ארנק אך התיקוף לא נקלט.",
  notime: "לא ניתנה הזדמנות סבירה לרכוש/לתקף לפני הביקורת.",
  details: "פרטי הדוח אינם תואמים (קו/שעה/תחנה).",
  student: "ברשותי כרטיס תלמיד/סטודנט בתוקף.",
  other: "קיימים נימוקים ענייניים לביטול הקנס.",
};

const schema = z.object({
  customerName: z.string().max(80).default(""),
  report: z.string().min(1).max(40),
  operator: z.string().min(1).max(80),
  reason: z.enum(["validator", "balance", "notime", "details", "student", "other"]),
  details: z.string().max(500).optional(),
  amountShekels: z.number().min(0).max(5000).optional(),
  operatorEmail: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  return handleReasonBasedCasePost(request, {
    schema,
    vertical: "transport-fine",
    cacheKeyPrefix: "cases-transport-fine",
    compose: (data, user) => {
      const name = data.customerName || user.name || "הלקוח/ה";
      const reasonText = REASON_BODY[data.reason] || REASON_BODY.other;
      const body = `לכבוד
מחלקת הערעורים / קנסות, ${data.operator}

הנדון: ערעור על דו"ח קנס מספר ${data.report}

שמי זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם ${name} ובהרשאתו/ה המפורשת (Mandate). אינני הלקוח/ה עצמו/ה.

בשם הלקוח/ה אני מערער על דו"ח הקנס שבנדון בגין נסיעה ללא כרטיס/תיקוף תקף.

${reasonText}${data.details ? `\n\nפירוט נוסף: ${data.details}` : ""}

בקשה אחת: ביטול הדו"ח בכתב. אם הבקשה תידחה — הנמקה מפורטת ופירוט זכות ההישפטות / ועדת ערר.

נא מענה בכתב בלבד.

בכבוד רב,
זכאי — סוכן דיגיטלי בשם ${name}`;

      return {
        outreachEmailCandidate: data.operatorEmail,
        knownInboxCandidate: resolveTransportContactEmail(data.operator) ?? undefined,
        provider: data.operator,
        amountShekels: data.amountShekels && data.amountShekels > 0 ? data.amountShekels : 180,
        planLabel: `קנס ${data.report}`,
        strategyLabel: "ערעור קנס תחבורה ציבורית עם Mandate",
        subject: `ערעור על קנס תחבורה ${data.report} — ${data.operator}`,
        body,
        beneficiaryLabel: data.customerName || undefined,
      };
    },
  });
}
