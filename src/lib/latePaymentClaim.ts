/**
 * Late payment to a supplier/freelancer — "מוסר תשלומים לספקים".
 *
 * A different customer than every other module in this app: not a consumer
 * facing a company or the state, but a freelancer or small business facing a
 * client who simply isn't paying on time. Same underlying primitive (a
 * documented right, a demand letter, a deadline) — a different person on the
 * sending end.
 *
 * THE LAW, VERIFIED (checked July 2026):
 *  - Fair Payment Practices to Suppliers Law, 5777-2017
 *    (חוק מוסר תשלומים לספקים, תשע"ז-2017). Applies to both private
 *    businesses and public bodies paying a supplier for goods or services.
 *  - Default maximum term: a private-sector payer must pay within 45 days of
 *    the end of the month the invoice was submitted, unless the contract
 *    validly sets a different term (and an extraordinarily unfair term does
 *    not count). This module treats 45 days as the default to flag against,
 *    not an absolute rule that overrides an actual contract.
 *  - Once payment is more than 30 days late, statutory late-payment interest
 *    (ריבית פיגורים) plus linkage (הצמדה) apply on top of the principal.
 *  - The law's protections can only be contracted away in the supplier's
 *    favour, never against them.
 *
 * Deliberately does not compute the actual interest/linkage amount owed —
 * that calculation depends on the Adjustment and Interest Law's published
 * rate over the specific period and is not something to state with false
 * precision here. What this module gives honestly: whether payment is
 * already late against the statutory default, and by how many days — the
 * demand letter asks the payer to calculate and add the statutory interest,
 * rather than this app inventing a figure.
 */

export const DEFAULT_PAYMENT_TERM_DAYS = 45;
export const LATE_INTEREST_THRESHOLD_DAYS = 30;

import { withFooter } from "./letterFooter";
import { agentLetterCloseHe, agentLetterOpenHe } from "@/lib/agentLetterVoice";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface LatePaymentInput {
  /** ISO date (yyyy-mm-dd) the invoice was submitted. */
  invoiceDate: string;
  /** Contractual payment term in days, if one exists and differs from the statutory default. */
  agreedTermDays?: number;
  now?: Date;
}

export interface LatePaymentStatus {
  /** The term actually being measured against — the agreed term if given, else the statutory default. */
  termDays: number;
  dueDate: Date;
  daysLate: number;
  isLate: boolean;
  /** True once the delay is long enough that statutory interest applies. */
  interestApplies: boolean;
}

function parseIsoDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function assessLatePayment(input: LatePaymentInput): LatePaymentStatus | null {
  const invoiceDate = parseIsoDate(input.invoiceDate);
  if (!invoiceDate) return null;

  const termDays = Math.max(1, Math.floor(input.agreedTermDays ?? DEFAULT_PAYMENT_TERM_DAYS));
  const now = input.now ?? new Date();

  const dueDate = new Date(invoiceDate.getTime() + termDays * MS_PER_DAY);
  const daysLate = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / MS_PER_DAY));

  return {
    termDays,
    dueDate,
    daysLate,
    isLate: daysLate > 0,
    interestApplies: daysLate > LATE_INTEREST_THRESHOLD_DAYS,
  };
}

export interface LatePaymentLetterInput {
  supplierName: string;
  clientName: string;
  invoiceNumber: string;
  invoiceAmountAgorot: number;
  status: LatePaymentStatus;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("he-IL");
}

/** Compose the demand letter body (Hebrew). Cites the law; never invents an interest figure. */
export function buildLatePaymentDemandLetter(input: LatePaymentLetterInput): string {
  const { supplierName, clientName, invoiceNumber, invoiceAmountAgorot, status } = input;
  const amount = `₪${(invoiceAmountAgorot / 100).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

  const interestLine = status.interestApplies
    ? "מאחר שהפיגור עולה על 30 יום, חלה גם ריבית פיגורים והפרשי הצמדה על הסכום, בהתאם לחוק. אבקש חישוב הריבית וההצמדה החלים ותשלומם יחד עם הקרן."
    : "ככל שהתשלום יתעכב מעבר ל-30 יום מהמועד לתשלום, תחול גם ריבית פיגורים והפרשי הצמדה בהתאם לחוק.";

  return withFooter(
    [
      `לכבוד ${clientName},`,
      "",
      agentLetterOpenHe(supplierName),
      "",
      `פנייה זו עניינה חשבונית מס' ${invoiceNumber} על סך ${amount} של הלקוח/ה, שמועד התשלום החוקי שלה חלף.`,
      "",
      `לפי חוק מוסר תשלומים לספקים, תשע"ז-2017, מועד התשלום המרבי לספק הוא ${status.termDays} יום מתום החודש שבו הומצאה החשבונית, אלא אם נקבע בחוזה מועד אחר כדין. מועד התשלום לפי זאת חל ב-${formatDate(status.dueDate)}, ונכון להיום חלפו ${status.daysLate} ימים מעבר למועד זה.`,
      "",
      interestLine,
      "",
      "בקשה אחת: הסדרת התשלום המלא בהקדם, ואישור בכתב על מועד ההעברה.",
      "",
      agentLetterCloseHe(supplierName),
    ].join("\n"),
  );
}
