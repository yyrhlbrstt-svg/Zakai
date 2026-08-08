/**
 * Multi-round consumer negotiation playbooks.
 * Solo / AI-only product: written only, documented, success-fee friendly.
 */

export type ProviderReplyKind =
  | "refused"
  | "too_low"
  | "delay"
  | "asked_call"
  | "accepted"
  | "competitor"
  /**
   * They agreed to credit an amount and the money did not arrive. A different
   * letter from every other kind here: the others argue about what is fair,
   * this one holds them to something they already conceded, which is a far
   * stronger position and should not be worded as another request for a
   * discount.
   */
  | "promise_broken"
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
  /** What they agreed to credit. Used only by `promise_broken`. */
  promisedShekels?: number;
  /** What actually arrived — zero when nothing did. Only by `promise_broken`. */
  observedShekels?: number;
  /** When the promise was made, as the person recorded it (yyyy-mm-dd). */
  promisedOnLabel?: string;
}

export interface FollowUpResult {
  subject: string;
  body: string;
  tip: string;
  nextIfNoReply: string;
}

function deadlineDays(round: number): number {
  if (round <= 2) return 5;
  if (round === 3) return 3;
  return 2;
}

export function buildFollowUp(input: FollowUpInput): FollowUpResult {
  const name = input.customerName.trim() || "הלקוח/ה";
  const provider = input.providerLabel;
  const current = input.amountOriginalShekels;
  const target = input.targetShekels;
  const mid = Math.round((current + target) / 2);
  const plan = input.plan?.trim() ? ` (מסלול: ${input.plan.trim()})` : "";
  const round = input.round ?? 2;
  const days = deadlineDays(round);

  const baseClose = `\n\nמצורף/קיים מסמך הרשאה מטעם הלקוח/ה עם אפשרות אימות. אודה למענה בכתב עם הצעה מדויקת (מחיר חודשי + תנאים + תאריך תחילה).\n\nבברכה,\nזכאי — סוכן דיגיטלי בשם ${name}`;

  const urgency =
    round >= 4
      ? `\n\nזו פנייה אחרונה בכתב לפני בחינת חלופות (הורדת מסלול / מעבר / ביטול חלקי).`
      : round >= 3
        ? `\n\nנודה למענה סופי בכתב תוך ${days} ימי עסקים.`
        : `\n\nנודה למענה בכתב תוך ${days} ימי עסקים.`;

  switch (input.replyKind) {
    case "refused":
      return {
        subject: `המשך פנייה — שימור לקוח קיים | ${name}`,
        tip: "כשאומרים לא — מבקשים נימוק בכתב + חלופות. לא נכנסים לוויכוח טלפוני.",
        nextIfNoReply:
          round >= 3
            ? "אם אין חלופה כתובה — עברו למסלול ביטול/מתחרה ותעדו בזכאי."
            : "תזכורת אחרי 5–7 ימי עסקים, ואז שקלו מתחרה / ביטול חלקי.",
        body: `לכבוד שירות הלקוחות של ${provider},

פנייה חוזרת (סיבוב ${round}) מטעם ${name}, באמצעות זכאי — סוכן דיגיטלי מורשה. אינני הלקוח/ה עצמו/ה.

התקבלה תשובה שאינה מאפשרת התאמת מחיר. מבקשים בכתב:
1. נימוק קצר מדוע לא ניתן מסלול שימור ללקוח קיים שמשלם כ-₪${current} בחודש${plan}.
2. חלופות: הורדת מסלול / הטבת נאמנות / התחייבות קצרה — בכיוון ₪${target}–₪${mid} לחודש.
3. פירוט חיובים נלווים שאינם הכרחיים לשימוש בפועל.

המטרה: הסכמה שקופה בכתב.${urgency}${baseClose}`,
      };

    case "too_low":
      return {
        subject: `בקשה לשיפור הצעה | ${name}`,
        tip: "מודים, מבקשים גישור — לא דחייה גסה. כל שקל ירידה = חיסכון מתועד.",
        nextIfNoReply: "אם ההצעה הסופית עדיין גבוהה — רשמו חיסכון חלקי בזכאי.",
        body: `לכבוד ${provider},

תודה על ההצעה. מטעם ${name} (באמצעות זכאי — סוכן דיגיטלי) מבקשים לשפר אותה.

החיוב הנוכחי כ-₪${current} לחודש${plan}. היעד מצד הלקוח/ה כ-₪${target}; אם אין אפשרות מלאה — הצעה משופרת סביב ₪${mid} עם פירוט מה כלול.

נא מענה בכתב בלבד.${urgency}${baseClose}`,
      };

    case "delay":
      return {
        subject: `תזכורת — פנייה ממתינה | ${name}`,
        tip: "תזכורת קצרה + תאריך יעד. שומרים על טון ענייני.",
        nextIfNoReply:
          round >= 3
            ? "עוד תזכורת אחת קצרה, ואז מתחרה או הורדת מסלול."
            : "עוד תזכורת אחת, ואז מתחרה או הורדת מסלול.",
        body: `לכבוד ${provider},

תזכורת מטעם ${name} באמצעות זכאי. הפנייה לגבי התאמת מחיר (כ-₪${current} → יעד כ-₪${target}) ממתינה למענה.

נא עדכון בכתב תוך ${days} ימי עסקים.${round >= 3 ? " זו תזכורת ממוקדת לפני בחינת חלופות." : ""}${baseClose}`,
      };

    case "asked_call":
      return {
        subject: `בקשה להצעה בכתב | ${name}`,
        tip: "כתב לפני שיחה — זה התיעוד שמצדיק עמלה רק על הצלחה.",
        nextIfNoReply: "חזרו על בקשת הכתב. אם חייבים שיחה — הלקוח מדבר ומעדכן בזכאי.",
        body: `לכבוד ${provider},

מטעם ${name} (זכאי — סוכן דיגיטלי): נשמח להצעת שימור בכתב (מייל/צ׳אט רשמי) — מחיר חודשי סופי, מה כלול, ותנאי התחייבות אם יש.

הלקוח/ה זמין/ה לשיחה לאחר קבלת ההצעה הכתובה.${urgency}${baseClose}`,
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

נא מענה מנומק בכתב.${urgency}${baseClose}`,
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

    /**
     * Holding them to something they already conceded. The tone is
     * deliberately different: no negotiation, no target price, no request for
     * a discount — the amount was agreed and is simply outstanding. Every
     * figure comes from what the person recorded, never from an estimate.
     */
    case "promise_broken":
      return buildPromiseBrokenFollowUp(input);

    default:
      return {
        subject: `המשך טיפול | ${name}`,
        tip: "הכול בכתב. כל הצעה חדשה נכנסת לזכאי.",
        nextIfNoReply: "תזכורת אחרי כמה ימי עסקים.",
        body: `לכבוד ${provider},

המשך פנייה מטעם ${name} באמצעות זכאי. נשמח למענה בכתב על התאמת חיוב (כ-₪${current}${plan} → יעד כ-₪${target}).${urgency}${baseClose}`,
      };
  }
}

/**
 * Holding them to something they already conceded.
 *
 * Shared by the monthly and lump playbooks on purpose: a promised credit is a
 * promised credit, and the argument does not change with the fee basis. It is
 * also the one letter here that must never read as a negotiation — the amount
 * was agreed, so asking for it "as a discount" would hand back the only strong
 * position the person has.
 *
 * Every figure comes from what the person recorded. Nothing is estimated,
 * because the whole force of the letter is that it quotes the counterparty's
 * own commitment back to them.
 */
export function buildPromiseBrokenFollowUp(input: FollowUpInput): FollowUpResult {
  const name = input.customerName.trim() || "הלקוח/ה";
  const provider = input.providerLabel;
  const round = input.round ?? 2;
  const days = deadlineDays(round);
  const promised = Math.max(0, Math.round(input.promisedShekels ?? 0));
  const observed = Math.max(0, Math.round(input.observedShekels ?? 0));
  const outstanding = Math.max(0, promised - observed);
  const when = input.promisedOnLabel?.trim();
  const whenLine = when ? ` (התחייבות מיום ${when})` : "";
  const partialLine =
    observed > 0
      ? `\nזוכה בפועל: ₪${observed}. היתרה שטרם זוכתה: ₪${outstanding}.`
      : `\nלא נמצא זיכוי כלשהו בדפי החשבון מאז.`;

  /**
   * Nothing is outstanding — they credited the full amount or more. Demanding
   * "a date to credit ₪0" would be absurd, and demanding the difference would
   * invent a debt. The useful letter here is the one that gets the completed
   * credit confirmed in writing, which is what makes it provable later.
   */
  if (outstanding === 0) {
    return {
      subject: `אישור ביצוע זיכוי — ₪${promised} | ${name}`,
      tip: "הכסף הגיע. מבקשים אישור כתוב כדי שיהיה תיעוד אם זה יתגלגל בחזרה.",
      nextIfNoReply: "אין צורך בהמשך טיפול — רשמו את הזיכוי בזכאי.",
      body: `לכבוד ${provider},

פנייה מטעם ${name}, באמצעות זכאי — סוכן דיגיטלי מורשה.

הזיכוי שסוכם${whenLine} בסך ₪${promised} אותר בדפי החשבון.

מבקשים אישור כתוב קצר הכולל את תאריך הזיכוי ומספר האסמכתה, לצורך תיעוד.

בברכה,
זכאי — סוכן דיגיטלי בשם ${name}`,
    };
  }

  return {
    subject: `זיכוי מוסכם שטרם בוצע — ₪${outstanding} | ${name}`,
    tip: "זו לא בקשה להנחה — הסכום כבר הוסכם. מבקשים תאריך ביצוע ואסמכתה, בכתב.",
    nextIfNoReply:
      "אם אין תאריך ביצוע בכתב — זו עילה לפנייה לממונה על פניות הציבור ברשות הרלוונטית.",
    body: `לכבוד ${provider},

פנייה מטעם ${name}, באמצעות זכאי — סוכן דיגיטלי מורשה. אינני הלקוח/ה עצמו/ה.

סוכם על זיכוי בסך ₪${promised}${whenLine}.${partialLine}

מבקשים בכתב:
1. תאריך מדויק לביצוע הזיכוי של ₪${outstanding}.
2. אסמכתה / מספר אישור לזיכוי.
3. אם לעמדתכם הזיכוי כבר בוצע — פירוט התאריך והמסמך שבו הוא מופיע.

נבקש להדגיש: אין מדובר בבקשה חדשה להנחה, אלא בהתחייבות קיימת שטרם קוימה.

נודה למענה בכתב תוך ${days} ימי עסקים.

מצורף/קיים מסמך הרשאה מטעם הלקוח/ה עם אפשרות אימות.

בברכה,
זכאי — סוכן דיגיטלי בשם ${name}`,
  };
}

export const REPLY_KIND_OPTIONS: { id: ProviderReplyKind; he: string; en: string }[] = [
  { id: "refused", he: "סירבו / אין הנחה", en: "Refused / no discount" },
  { id: "too_low", he: "הציעו מעט מדי", en: "Offer too low" },
  { id: "delay", he: "לא ענו / סחבו", en: "No reply / delay" },
  { id: "asked_call", he: "ביקשו רק טלפון", en: "Asked for a call only" },
  { id: "competitor", he: "יש הצעת מתחרה", en: "Have a competitor offer" },
  { id: "accepted", he: "הסכימו — צריך אישור כתוב", en: "Agreed — need written confirm" },
  {
    id: "promise_broken",
    he: "הבטיחו זיכוי — לא הגיע",
    en: "Promised a credit — never arrived",
  },
  { id: "other", he: "אחר", en: "Other" },
];
