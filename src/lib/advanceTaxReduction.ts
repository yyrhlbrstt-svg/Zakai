/**
 * Advance tax reduction (הקטנת מקדמות) for the self-employed — the first
 * feature in this codebase aimed specifically at עצמאים rather than salaried
 * employees.
 *
 * Self-employed people pay income-tax advances (מקדמות) through the year,
 * set by the Tax Authority as a percentage of turnover from a prior period.
 * When this year's actual or expected income drops well below that prior
 * period — a slow year, a closed business line, parental leave — the
 * advance rate keeps charging as if nothing changed. The money isn't lost;
 * it comes back as a refund after the annual return is filed, months later.
 * Meanwhile it sits with the Tax Authority instead of the business.
 *
 * THE FACTS, VERIFIED (checked July 2026, via the Israel Tax Authority /
 * gov.il):
 *  - Form 2216א׳ — "בקשה לביטול או הקטנת מקדמות מס" — lets a taxpayer who
 *    believes this year's advance rate is higher than the tax actually owed
 *    ask the assessing office to reduce or cancel it, with an explanation
 *    and supporting documents.
 *    https://www.gov.il/he/service/itc-2216a
 *  - The form must be printed, filled out by hand and signed — it is not an
 *    online submission — and filed at the assessing office (פקיד השומה)
 *    where the taxpayer's file is held.
 *  - Last date to file a request for a given tax year: January 31 of the
 *    following year.
 *
 * This module never invents a "correct" advance-rate percentage — that is
 * the assessing officer's call, based on documentation this module can't
 * see. It only helps decide whether the request is still open to file and
 * drafts the covering letter; the requested rate is left for the taxpayer
 * (or their accountant) to fill in by hand on the form itself, exactly as
 * the real process requires.
 */

import { withFooter } from "./letterFooter";

export const ADVANCE_TAX_FORM_URL = "https://www.gov.il/he/service/itc-2216a";

/** Last day to file a reduction/cancellation request for `taxYear`: Jan 31 of the following year. */
export function advanceTaxReductionDeadline(taxYear: number): Date {
  return new Date(Date.UTC(taxYear + 1, 0, 31));
}

/** Whole days left to file for `taxYear`, as of `now`. Negative once the window has closed. */
export function daysUntilAdvanceTaxDeadline(taxYear: number, now: Date = new Date()): number {
  const deadline = advanceTaxReductionDeadline(taxYear);
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** True while a request for `taxYear` can still be filed, as of `now`. */
export function canStillFileForYear(taxYear: number, now: Date = new Date()): boolean {
  return daysUntilAdvanceTaxDeadline(taxYear, now) >= 0;
}

export interface AdvanceTaxLetterInput {
  name: string;
  taxFileNumber: string;
  taxYear: number;
  reason: string;
}

/** Compose the covering letter to the assessing office. The requested rate is left for the printed form, filled by hand. */
export function buildAdvanceTaxReductionLetter(input: AdvanceTaxLetterInput): string {
  const { name, taxFileNumber, taxYear, reason } = input;

  return withFooter(
    [
      "לכבוד פקיד השומה,",
      "",
      `שמי ${name}, מספר תיק ${taxFileNumber}.`,
      "",
      `שיעור המקדמות שנקבע לי לשנת המס ${taxYear} מבוסס על מחזור עסקי מתקופה קודמת, וגבוה מסכום המס שאני צפוי לחוב בפועל השנה, מהסיבה הבאה:`,
      "",
      reason,
      "",
      "בהתאם לכך אני מבקש/ת לבטל או להקטין את המקדמות שנקבעו לי, כמפורט בטופס 2216א׳ המצורף וחתום בכתב ידי, בצירוף המסמכים התומכים בבקשה.",
      "",
      "בכבוד רב,",
      name,
    ].join("\n"),
  );
}

/**
 * Tax years a reduction request can sensibly be filed for.
 *
 * The year was a bare `type="number"` box, and everything on the screen is
 * derived from it: the deadline, the countdown, the reminder date, the year
 * printed in a letter addressed to an assessing officer. Typing 120000 —
 * which a number spinner on a phone makes easy — produced "43,089,291 days
 * left to file for this tax year", stated as fact in a box styled to look
 * authoritative. It is derived correctly from nonsense, which is the worst
 * kind of wrong: the arithmetic is impeccable and the sentence is a lie.
 *
 * A reduction request only concerns the current tax year and, before the
 * January 31 cutoff, the one just ended. The range is generous around that
 * rather than exact, because being slightly permissive costs nothing and
 * being wrong about somebody's edge case costs them the tool.
 */
export const EARLIEST_FILEABLE_TAX_YEAR_OFFSET = -6;
export const LATEST_FILEABLE_TAX_YEAR_OFFSET = 1;

export function taxYearRange(now: Date = new Date()): { min: number; max: number } {
  const year = now.getFullYear();
  return {
    min: year + EARLIEST_FILEABLE_TAX_YEAR_OFFSET,
    max: year + LATEST_FILEABLE_TAX_YEAR_OFFSET,
  };
}

/** Snap a typed year into the fileable range; anything unparseable becomes this year. */
export function clampTaxYear(value: number, now: Date = new Date()): number {
  const { min, max } = taxYearRange(now);
  if (!Number.isFinite(value)) return now.getFullYear();
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
