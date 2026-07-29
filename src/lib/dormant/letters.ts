/**
 * The demand that makes an institution look.
 *
 * WHY A LETTER BEATS A SEARCH, WHICH IS THE WHOLE THESIS OF THIS MODULE
 *
 * A registry search answers a question the registry was built to answer, on the
 * index it happens to hold. A written demand is answered against the
 * institution's own records, by a regulated body that owes a duty to reply, and
 * it leaves a dated document behind. The second one is both more thorough and
 * more useful later, and — not incidentally — it is something that can be done
 * from inside the app without sending anybody anywhere.
 *
 * TWO LETTERS, BECAUSE A BEREAVED FAMILY IS NOT IN THE SAME SITUATION
 *
 * Claiming your own forgotten account is administrative. Claiming a dead
 * parent's is not: the paperwork is different, the legal basis is different,
 * and the tone has to be different. Reusing one template for both would produce
 * a letter that reads as a form asking a grieving family for their file number.
 *
 * WHAT THE LETTERS DO NOT SAY
 *
 * They do not assert that anything is being held. They ask, in a form that
 * requires a definite answer — including an explicit answer of "nothing", which
 * is the reply people never get because they never ask in writing.
 */

import { withFooter } from "../letterFooter";
import { type DormantLead } from "./trace";

export interface DormantLetterFields {
  name?: string;
  id?: string;
  /** The institution being written to: fund, bank, insurer, employer. */
  counterparty?: string;
  /** Employer name for a per-employer lead, when they can remember it. */
  employer?: string;
  /** Rough period of the employment or the relationship. */
  period?: string;
  /** For heir letters: the deceased's name and identity number. */
  deceasedName?: string;
  deceasedId?: string;
  relationship?: string;
}

export interface DormantLetter {
  subject: string;
  body: string;
  as: "self" | "heir";
}

function blank(value: string | undefined, placeholder: string): string {
  return value && value.trim() ? value.trim() : `[${placeholder}]`;
}

export function buildDormantLetter(
  lead: DormantLead,
  fields: DormantLetterFields = {},
): DormantLetter {
  const to = blank(fields.counterparty, "שם הגוף");
  const name = blank(fields.name, "שם מלא");
  const id = blank(fields.id, "מספר זהות");

  if (lead.as === "heir") {
    const dName = blank(fields.deceasedName, "שם הנפטר/ת");
    const dId = blank(fields.deceasedId, "מספר הזהות של הנפטר/ת");
    const rel = blank(fields.relationship, "קרבה משפחתית");

    return {
      as: "heir",
      subject: `בקשת יורש לגילוי נכסים — ${dName}`,
      body: withFooter([
        `לכבוד`,
        to,
        "",
        `שם הפונה: ${name}`,
        `ת״ז: ${id}`,
        `קרבה למנוח/ה: ${rel}`,
        "",
        `הנדון: בקשה לגילוי זכויות ונכסים על שם ${dName}, ת״ז ${dId}`,
        "",
        `אני פונה אליכם בעניין ${dName}, אשר נפטר/ה. מצורפים תעודת פטירה וצו ירושה או צו קיום צוואה.`,
        "",
        "אבקש מכם, בתוך 21 ימים:",
        "1. לבדוק ברישומיכם קיומם של חשבונות, פוליסות, קופות, קרנות או יתרות כלשהן על שם הנ״ל — לרבות כאלה שאינם פעילים.",
        "2. למסור תשובה מפורשת בכתב גם אם לא נמצא דבר, לרבות פירוט המאגרים שנבדקו.",
        "3. ככל שנמצא — למסור פירוט מלא: מספר החשבון או הפוליסה, היתרה, המוטבים הרשומים, ודמי הניהול שנגבו מאז הפטירה.",
        "4. למסור את רשימת המסמכים הדרושים להעברת הזכויות ליורשים.",
        "",
        `הבסיס לפנייה: ${lead.source.duty}.`,
        "",
        "אין בפנייה זו כדי לוותר על טענה כלשהי.",
        "",
        "בכבוד רב,",
        name,
      ].join("\n"), "he"),
    };
  }

  const era = lead.employerIndex
    ? ` (תקופת העסקה אצל ${blank(fields.employer, "שם המעסיק")}${
        fields.period ? `, ${fields.period}` : ""
      })`
    : "";

  return {
    as: "self",
    subject: `בקשה לגילוי זכויות וחשבונות על שמי${era}`,
    body: withFooter([
      `לכבוד`,
      to,
      "",
      `שם: ${name}`,
      `ת״ז: ${id}`,
      "",
      `הנדון: בקשה לגילוי כל הזכויות, החשבונות והיתרות הרשומים על שמי${era}`,
      "",
      "אבקש מכם, בתוך 21 ימים:",
      "1. לבדוק ברישומיכם קיומם של חשבונות, קופות, קרנות, פוליסות או יתרות כלשהן על שמי — לרבות חשבונות לא פעילים, חשבונות ללא תנועה וכספים שאינם מנוהלים.",
      "2. למסור תשובה מפורשת בכתב גם אם לא נמצא דבר, לרבות פירוט המאגרים והשנים שנבדקו.",
      "3. ככל שנמצא — למסור פירוט מלא: מספר החשבון או הפוליסה, מועד הפתיחה, היתרה הנוכחית, ופירוט דמי הניהול והעמלות שנגבו מאז הפסקת הפעילות.",
      "4. למסור את המסמכים הדרושים למשיכה, לניוד או לחידוש הפעילות.",
      "",
      `הבסיס לפנייה: ${lead.source.duty}.`,
      "",
      "אבקש כי התשובה תישלח אליי בכתב, ואם קיימת כתובת ישנה ברישומיכם — אבקש לעדכנה לפי הפרטים שמסרתי.",
      "",
      "בכבוד רב,",
      name,
    ].join("\n"), "he"),
  };
}
