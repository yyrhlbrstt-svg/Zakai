import { z } from "zod";
import { handleReasonBasedCasePost } from "@/lib/services/reasonBasedCaseIntake";

const REASON_BODY: Record<string, string> = {
  signage: "השילוט במקום לא היה ברור / לא נראה / סותר.",
  machine: "מכונת התשלום הייתה מקולקלת או לא זמינה.",
  loading: "עמדתי לצורך פריקה/טעינה קצרה כמותר.",
  disabled: "ברשותי תו נכה בתוקף שהיה מוצג כנדרש.",
  details: "פרטי הדוח אינם תואמים את המציאות (מקום/שעה/רכב).",
  other: "קיימים נימוקים ענייניים לביטול הדוח.",
};

const schema = z.object({
  customerName: z.string().max(80).default(""),
  ticket: z.string().min(1).max(40),
  city: z.string().min(1).max(60),
  reason: z.enum(["signage", "machine", "loading", "disabled", "details", "other"]),
  details: z.string().max(500).optional(),
  amountShekels: z.number().min(0).max(10000).optional(),
  authorityEmail: z.string().max(120).optional(),
});

export async function POST(request: Request) {
  return handleReasonBasedCasePost(request, {
    schema,
    vertical: "parking",
    cacheKeyPrefix: "cases-parking",
    compose: (data, user) => {
      const name = data.customerName || user.name || "הלקוח/ה";
      const reasonText = REASON_BODY[data.reason] || REASON_BODY.other;
      const body = `לכבוד
מחלקת הפיקוח / הגבייה, עיריית ${data.city}

הנדון: ערעור על דוח חניה מספר ${data.ticket}

שמי זכאי, סוכן דיגיטלי אוטומטי הפועל מטעם ${name} ובהרשאתו/ה המפורשת (Mandate). אינני הלקוח/ה עצמו/ה.

בשם הלקוח/ה אני מערער על דוח החניה שבנדון.

${reasonText}${data.details ? `\n\nפירוט נוסף: ${data.details}` : ""}

בקשה אחת: ביטול הדוח בכתב. ככל שהבקשה תידחה — הנמקה מפורטת ופירוט זכות ההישפטות בבית המשפט לעניינים מקומיים.

נא מענה בכתב בלבד.

בכבוד רב,
זכאי — סוכן דיגיטלי בשם ${name}`;

      return {
        outreachEmailCandidate: data.authorityEmail,
        provider: `עיריית ${data.city}`,
        amountShekels: data.amountShekels && data.amountShekels > 0 ? data.amountShekels : 100,
        planLabel: `דוח ${data.ticket}`,
        strategyLabel: "ערעור דוח חניה עם Mandate",
        subject: `ערעור על דוח חניה ${data.ticket} — עיריית ${data.city}`,
        body,
        beneficiaryLabel: data.customerName || undefined,
      };
    },
  });
}
