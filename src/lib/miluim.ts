/**
 * Reserve-duty (miluim) pay calculator — the most under-claimed money in
 * Israel since October 2023. Employers must pay reservists their regular
 * salary and claim reimbursement from the National Insurance Institute
 * (form BL/501); reservists whose employer didn't pass the money on within
 * ~3 weeks of the service's end file a personal claim (BL/502).
 *
 * Statutory formula (Bituach Leumi rules):
 *  - Employee: daily rate = gross pay of the 3 months before service ÷ 90.
 *  - Self-employed: daily rate = (insured income of that period × 1.25) ÷ 90.
 *  - Plus the 20% supplement (in force since the Swords-of-Iron measures)
 *    that most claimants don't know exists.
 * Statutory daily minimums/maximums (index-linked) may adjust the figure —
 * the UI discloses this. Deterministic, integer agorot, fully tested.
 */

export type MiluimEmployment = "employee" | "self_employed";

export interface MiluimInput {
  employment: MiluimEmployment;
  /** Gross pay (employee) or insured income (self-employed) for the 3 months before service, agorot. */
  threeMonthAgorot: number;
  /** Days of reserve service in the claim. */
  serviceDays: number;
}

export interface MiluimResult {
  dailyAgorot: number;
  baseAgorot: number;
  /** The 20% supplement most claimants miss. */
  supplementAgorot: number;
  totalAgorot: number;
}

/** Self-employed base is grossed up by 25% before the ÷90. */
const SELF_EMPLOYED_FACTOR = 1.25;
/** The across-the-board 20% supplement. */
const SUPPLEMENT_RATE = 0.2;

export function computeMiluim(input: MiluimInput): MiluimResult {
  const three = Math.max(0, Math.trunc(input.threeMonthAgorot));
  const days = Math.max(0, Math.trunc(input.serviceDays));

  const basis =
    input.employment === "self_employed" ? Math.round(three * SELF_EMPLOYED_FACTOR) : three;
  const dailyAgorot = Math.round(basis / 90);
  const baseAgorot = dailyAgorot * days;
  const supplementAgorot = Math.round(baseAgorot * SUPPLEMENT_RATE);

  return {
    dailyAgorot,
    baseAgorot,
    supplementAgorot,
    totalAgorot: baseAgorot + supplementAgorot,
  };
}
