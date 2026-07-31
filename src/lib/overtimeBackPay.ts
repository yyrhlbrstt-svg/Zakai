/**
 * Overtime back-pay — "שעות נוספות שלא שולמו".
 *
 * Distinct from payslip.ts on purpose: that module audits one slip against
 * this month's expectation. This one estimates what a pattern of unpaid
 * overtime is worth accumulated across years, because that is the actual
 * shape of the problem — a worker who has been shorted ₪400/month for three
 * years is owed roughly ₪14,400, and a single-slip check can never surface
 * that number.
 *
 * THE LAW, VERIFIED (not recalled from memory — checked July 2026):
 *  - Overtime rate: Hours of Work and Rest Law, 5711-1951
 *    (חוק שעות עבודה ומנוחה, תשי"א-1951), section 16 — at least 125% of the
 *    regular hourly wage for the first two overtime hours in a working day,
 *    at least 150% for every hour beyond that.
 *  - This is a cogent right (זכות קוגנטית): an employee cannot validly waive
 *    it even by their own stated agreement.
 *  - Lookback: Statute of Limitations Law, 5718-1958 (חוק ההתיישנות,
 *    תשי"ח-1958), section 5 — the general 7-year civil limitation period,
 *    which case law applies to wage-differential claims. Claims older than
 *    that are not quantified here — not because they don't exist, but
 *    because a number outside what the law actually lets a court award is a
 *    number this product will not put in front of a worker.
 *  - Burden of proof: where the hours actually worked are disputed and the
 *    employer produced no attendance record, the burden shifts to the
 *    employer to show the worker was not available for work during the
 *    disputed hours — worth stating in the letter, not just the number.
 *
 * Deliberately does not attempt to compute exact historical wage indexation
 * or court-awarded interest — those are for a labour court or lawyer to
 * finalise. This gives a conservative, honestly-labelled estimate to open
 * the conversation, the same posture as every other calculator in this app.
 */

import { withFooter } from "./letterFooter";

export const OVERTIME_TIER1_RATE_BPS = 12_500; // 125%
export const OVERTIME_TIER2_RATE_BPS = 15_000; // 150%
/** First N overtime hours per day at the lower (125%) rate. */
export const TIER1_DAILY_HOURS = 2;
/** Statute of limitations for a wage-differential claim, in years. */
export const LOOKBACK_YEARS_MAX = 7;

export interface OvertimeInput {
  /** Regular hourly wage, in agorot. */
  hourlyWageAgorot: number;
  /** Average unpaid overtime hours worked per day, beyond the standard day. */
  dailyOvertimeHours: number;
  /** Average working days per month this pattern applied. */
  daysPerMonth: number;
  /** How many months this pattern has been going on, at this employer. */
  monthsWorked: number;
}

export interface OvertimeBackPay {
  tier1HoursDaily: number;
  tier2HoursDaily: number;
  dailyPayAgorot: number;
  monthlyPayAgorot: number;
  /** Months actually counted — monthsWorked capped at the statutory lookback. */
  monthsCounted: number;
  totalAgorot: number;
  /** True when monthsWorked exceeded the lookback and were capped. */
  capped: boolean;
}

const round = Math.round;

export interface OvertimeLetterInput {
  employeeName: string;
  employerName: string;
  monthsWorked: number;
  result: OvertimeBackPay;
}

/**
 * Compose the demand letter body (Hebrew — the employer's service language).
 * States the legal basis, the estimate, and the burden-of-proof rule this
 * module's own doc comment cites — not just a number with no source.
 */
export function buildOvertimeDemandLetter(input: OvertimeLetterInput): string {
  const { employeeName, employerName, result } = input;
  const money = (agorot: number) => `₪${(agorot / 100).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

  const lookbackNote = result.capped
    ? `התקופה המתועדת ארוכה משבע שנים; החישוב הבא מוגבל לשבע השנים האחרונות בלבד, בהתאם לתקופת ההתיישנות הקבועה בחוק ההתיישנות, תשי"ח-1958, סעיף 5.`
    : "";

  return withFooter(
    [
      `לכבוד ${employerName},`,
      "",
      `שמי ${employeeName}, ואני עובד/ת אצלכם. פנייה זו עניינה גמול שעות נוספות שלא שולם לי במלואו.`,
      "",
      `לפי סעיף 16 לחוק שעות עבודה ומנוחה, תשי"א-1951, מגיע גמול של 125% לפחות משכר השעה הרגיל עבור שתי השעות הנוספות הראשונות ביום עבודה, ו-150% לפחות עבור כל שעה נוספת שאחריהן. זוהי זכות קוגנטית שאינה ניתנת לוויתור.`,
      "",
      `להערכתי, בהתבסס על ${result.monthsCounted} חודשי עבודה בדפוס שעות זה, מגיע לי סכום מצטבר של כ-${money(result.totalAgorot)}.`,
      lookbackNote,
      "",
      "אבקש בזאת: (1) לקבל את דוחות הנוכחות שברשותכם לתקופה הרלוונטית; (2) לקבל חישוב מפורט של גמול השעות הנוספות ששולם בפועל מול המגיע לפי חוק; (3) להסדיר את ההפרש.",
      "",
      "למקרה שמספר השעות שנוי במחלוקת: ככל שלא הוצגו רישומי נוכחות מטעמכם, נטל ההוכחה כי לא עמדתי לרשות העבודה בשעות השנויות במחלוקת חל עליכם.",
      "",
      "אשמח לתשובה בכתב בתוך 14 יום.",
      "",
      "בברכה,",
      employeeName,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

export function computeOvertimeBackPay(input: OvertimeInput): OvertimeBackPay {
  const wage = Math.max(0, input.hourlyWageAgorot);
  const overtimeHours = Math.max(0, input.dailyOvertimeHours);
  const daysPerMonth = Math.max(0, input.daysPerMonth);
  const monthsWorked = Math.max(0, Math.floor(input.monthsWorked));

  const tier1HoursDaily = Math.min(overtimeHours, TIER1_DAILY_HOURS);
  const tier2HoursDaily = Math.max(0, overtimeHours - TIER1_DAILY_HOURS);

  const tier1Rate = round((wage * OVERTIME_TIER1_RATE_BPS) / 10_000);
  const tier2Rate = round((wage * OVERTIME_TIER2_RATE_BPS) / 10_000);

  const dailyPayAgorot = round(tier1HoursDaily * tier1Rate + tier2HoursDaily * tier2Rate);
  const monthlyPayAgorot = round(dailyPayAgorot * daysPerMonth);

  const lookbackMonths = LOOKBACK_YEARS_MAX * 12;
  const monthsCounted = Math.min(monthsWorked, lookbackMonths);
  const capped = monthsWorked > lookbackMonths;

  return {
    tier1HoursDaily,
    tier2HoursDaily,
    dailyPayAgorot,
    monthlyPayAgorot,
    monthsCounted,
    totalAgorot: round(monthlyPayAgorot * monthsCounted),
    capped,
  };
}
