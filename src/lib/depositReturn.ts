/**
 * Rental security deposit return — a tenant who already vacated, chasing a
 * landlord who is sitting on the deposit. Same primitive as late-payment (a
 * documented right, a deadline, a demand letter), and the same low
 * relationship-risk shape: the tenancy is over, so an automated agent demand
 * doesn't carry the retaliation risk an ongoing relationship would (compare
 * overtime-backpay, which stays self-help for exactly that reason).
 *
 * THE LAW, VERIFIED (checked July 2026, via the 2017 gazette text and
 * corroborating law-firm summaries — Kol-Zchut does not carry a dedicated
 * page for the return deadline itself, only the related deposit-cap and
 * use-of-deposit-notice rights):
 *  - Rent and Loan Law, 5731-1971 (חוק השכירות והשאילה, תשל"א-1971), as
 *    amended by the Fair Rental Law amendment, 5777-2017 (תיקון "שכירות
 *    הוגנת"), in force from 17 September 2017.
 *  - A cash/guarantee security deposit must be returned to the tenant within
 *    60 days of the date the tenant vacates the property, or once any debt
 *    it secures is settled — whichever comes first.
 *  - The landlord may deduct only an actual, proven debt (unpaid rent, unpaid
 *    utility/arnona bills in the tenant's name, or real damage beyond
 *    reasonable wear) — never as a blanket "security" without a claimed debt.
 *  - For a standard-length lease the deposit itself is capped at 3 months'
 *    rent (a shorter cap applies to short-term lets, which this module does
 *    not attempt to compute — the standard cap is stated as what usually
 *    applies, not an unconditional rule).
 *
 * Deliberately does not attempt small-claims filing mechanics or compute
 * statutory interest on a withheld deposit — the demand letter asks for the
 * principal back and reserves the small-claims option, rather than inventing
 * a figure for a claim this module cannot verify case by case.
 */

export const DEPOSIT_RETURN_DEADLINE_DAYS = 60;
export const MAX_DEPOSIT_MONTHS_RENT = 3;

import { withFooter } from "./letterFooter";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface DepositReturnInput {
  /** ISO date (yyyy-mm-dd) the tenant vacated / returned the keys. */
  vacateDate: string;
  now?: Date;
}

export interface DepositReturnStatus {
  dueDate: Date;
  daysLate: number;
  isLate: boolean;
}

function parseIsoDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function assessDepositReturn(input: DepositReturnInput): DepositReturnStatus | null {
  const vacateDate = parseIsoDate(input.vacateDate);
  if (!vacateDate) return null;

  const now = input.now ?? new Date();
  const dueDate = new Date(vacateDate.getTime() + DEPOSIT_RETURN_DEADLINE_DAYS * MS_PER_DAY);
  const daysLate = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY));

  return { dueDate, daysLate, isLate: daysLate > 0 };
}

export interface DepositCapCheck {
  /** True when the deposit collected exceeds the standard-lease cap. */
  exceeds: boolean;
  capAgorot: number;
}

/** Optional, separate fact: is the deposit itself larger than the standard-lease cap allows? */
export function checkDepositCap(
  depositAgorot: number,
  monthlyRentAgorot: number,
): DepositCapCheck | null {
  if (monthlyRentAgorot <= 0) return null;
  const capAgorot = monthlyRentAgorot * MAX_DEPOSIT_MONTHS_RENT;
  return { exceeds: depositAgorot > capAgorot, capAgorot };
}

export interface DepositLetterInput {
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
  depositAmountAgorot: number;
  status: DepositReturnStatus;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("he-IL");
}

/** Compose the demand letter body (Hebrew). Cites the law; never invents an interest figure. */
export function buildDepositDemandLetter(input: DepositLetterInput): string {
  const { tenantName, landlordName, propertyAddress, depositAmountAgorot, status } = input;
  const amount = `₪${(depositAmountAgorot / 100).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

  return withFooter(
    [
      `לכבוד ${landlordName},`,
      "",
      `שמי ${tenantName}. שכרתי ממך את הדירה ברחוב ${propertyAddress}, ופיניתי אותה והחזרתי את המפתחות. עד היום לא הושב לי פיקדון השכירות בסך ${amount}.`,
      "",
      `לפי חוק השכירות והשאילה, התשל"א-1971 (כנוסחו לאחר תיקון "שכירות הוגנת", התשע"ז-2017), על המשכיר להשיב את הפיקדון בתוך ${DEPOSIT_RETURN_DEADLINE_DAYS} יום ממועד הפינוי, או עם סילוק כל חוב שהפיקדון נועד להבטיח — לפי המוקדם. מועד ההשבה לפי זאת חל ב-${formatDate(status.dueDate)}, ונכון להיום חלפו ${status.daysLate} ימים מעבר למועד זה.`,
      "",
      "ניתן לקזז מהפיקדון רק חוב מוכח בפועל — שכר דירה שלא שולם, חשבונות פתוחים על שמי, או נזק ממשי מעבר לבלאי סביר — ובכפוף להצגת אסמכתאות. החזקת הפיקדון ללא חוב מוכח וללא הנמקה בכתב אינה כדין.",
      "",
      "לפיכך אני דורש/ת את השבת מלוא הפיקדון בהקדם. ככל שברצונך לקזז סכום כלשהו, אבקש פירוט בכתב ואסמכתאות לכל ניכוי בתוך זמן סביר. בהיעדר מענה, אשקול פנייה לתביעות קטנות להשבת הסכום.",
      "",
      "בברכה,",
      tenantName,
    ].join("\n"),
  );
}
