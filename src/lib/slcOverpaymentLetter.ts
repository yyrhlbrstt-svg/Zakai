/**
 * Student Loans Company overpayment refund letter — Education (Student
 * Loans) Regulations 1998 and SLC published repayment guidance, the same
 * citation already registered in this codebase's UK rights catalog
 * (src/lib/global/packs/gb.ts, right id "student_loan_overpayment"). Purely
 * a self-serve letter draft, same tier as fdcpaValidationLetter.ts: no
 * Case, no Mandate, no fee — the visitor copies and sends it themselves.
 *
 * Deliberately never asks for a National Insurance number: the SLC can
 * locate an account from name, date of birth and customer reference
 * without it, and collecting NI numbers on a public web form is a real
 * data-protection liability this tool has no reason to take on.
 */

export interface SlcOverpaymentInput {
  customerName: string;
  customerReference?: string;
  accountDetails: string;
}

const SLC_ADDRESS = "Student Loans Company\n100 Bothwell Street\nGlasgow G2 7JD";

export function buildSlcOverpaymentLetter(input: SlcOverpaymentInput): {
  subject: string;
  body: string;
} {
  const name = input.customerName.trim() || "[Your name]";
  const reference = input.customerReference?.trim();
  const details = input.accountDetails.trim() || "[Plan type and repayment account details]";

  return {
    subject: "Request for refund of student loan overpayment",
    body: `${SLC_ADDRESS}

I am ${name}.${reference ? ` Customer reference: ${reference}.` : ""}

I believe repayments have continued after my loan balance was cleared, or that an incorrect balance has caused me to overpay, under the Education (Student Loans) Regulations 1998.

Plan and account details: ${details}

Please confirm the current balance, any credit balance on the account, and repay any sum paid in excess of the amount properly due.

${name}`,
  };
}
