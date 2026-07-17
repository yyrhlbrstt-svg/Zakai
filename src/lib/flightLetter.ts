/**
 * Flight-compensation demand letter generator — closing the loop on the
 * flights vertical TODAY, before the full agent-acted claim flow: Zakai
 * drafts a legally-grounded Hebrew demand letter; the passenger sends it
 * in their own name (no power of attorney needed — legally clean, zero
 * friction). Deterministic template, rendered fully client-side: the
 * passenger's details never leave the browser.
 */

import {
  computeEntitlement,
  computeEntitlementEU,
  type Disruption,
  type EuDisruption,
} from "./flightRights";
import { formatAgorot } from "./money";

export interface FlightLetterInput {
  passengerName: string;
  airline: string;
  flightNumber: string;
  flightDate: string; // as typed, e.g. "12/06/2026"
  route: string; // e.g. "תל אביב – רומא"
  jurisdiction: "il" | "eu";
  disruption: Disruption | EuDisruption;
}

/** Compose the demand letter body (Hebrew — the airline's service language). */
export function buildFlightDemandLetter(input: FlightLetterInput): string {
  const isEU = input.jurisdiction === "eu";
  const legal = isEU
    ? "תקנה (EC) 261/2004 של האיחוד האירופי"
    : 'חוק שירותי תעופה (פיצוי וסיוע בשל ביטול טיסה או שינוי בתנאיה), התשע"ב-2012';

  const ent = isEU
    ? computeEntitlementEU(input.disruption as EuDisruption)
    : computeEntitlement(input.disruption as Disruption);

  const compensation = isEU
    ? "compensationEur" in ent && ent.compensationEur > 0
      ? `€${ent.compensationEur}`
      : null
    : "compensationAgorot" in ent && ent.compensationAgorot > 0
      ? formatAgorot(ent.compensationAgorot, "he-IL")
      : null;

  const d = input.disruption;
  const eventLine =
    d.kind === "cancelled"
      ? `הטיסה בוטלה, וההודעה על כך נמסרה לי ${d.noticeDaysAhead < 14 ? "פחות מ-14 ימים" : "14 ימים או יותר"} לפני מועד ההמראה.`
      : `הטיסה הגיעה ליעדה באיחור של ${describeDelay(d.delayHours)}.`;

  const demands: string[] = [];
  if (compensation) {
    demands.push(
      `פיצוי כספי קבוע בסך ${compensation} כקבוע ב${isEU ? "תקנה" : "חוק"} — ללא צורך בהוכחת נזק`,
    );
  }
  if (ent.refundOrAlternative) {
    demands.push("ככל שרלוונטי — השבת התמורה ששולמה או כרטיס חלופי, לפי בחירתי");
  }
  if (ent.assistance) {
    demands.push("החזר הוצאות שנגרמו בשל היעדר שירותי הסיוע שהחוק מחייב (קבלות שמורות בידי)");
  }

  const demandsBlock = demands.map((x, i) => `${i + 1}. ${x}`).join("\n");

  return `לכבוד: מחלקת שירות הלקוחות, ${input.airline}
הנדון: דרישת פיצוי בגין שיבוש טיסה ${input.flightNumber} בתאריך ${input.flightDate}

שלום רב,

אני, ${input.passengerName}, הייתי נוסע/ת בטיסה ${input.flightNumber} של ${input.airline} בקו ${input.route}, שתוכננה לתאריך ${input.flightDate}. ${eventLine}

בהתאם ל${legal}, אני זכאי/ת לסעדים הבאים, ואני דורש/ת אותם בזאת:

${demandsBlock}

אבקש את התייחסותכם ואת ביצוע התשלום בתוך 21 ימים ממועד פנייה זו. ככל שלא אקבל מענה הולם במועד, אשקול פנייה לערכאות המוסמכות, לרבות תביעה בבית המשפט לתביעות קטנות — שם נפסקות בעניינים אלה גם הוצאות ועוגמת נפש — ו/או תלונה לרשות התעופה האזרחית.

נא לראות בפנייה זו דרישה רשמית. אשמח לקבל את אישורכם על קבלתה.

בכבוד רב,
${input.passengerName}
(המכתב נוסח בסיוע זכאי — zakai)`;
}

function describeDelay(hours: number): string {
  if (hours >= 8) return "יותר מ-8 שעות";
  if (hours >= 5) return "בין 5 ל-8 שעות";
  if (hours >= 3) return "יותר מ-3 שעות";
  if (hours >= 2) return "יותר משעתיים";
  return "פחות משעתיים";
}
