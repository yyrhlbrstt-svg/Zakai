/**
 * FLSA wage-statement / deduction-detail request letter — Fair Labor
 * Standards Act and applicable state wage-and-hour law, the same citation
 * already registered in this codebase's US rights catalog
 * (src/lib/global/packs/us.ts, right id "wage_statement_audit"). Purely a
 * self-serve letter draft, same tier as fdcpaValidationLetter.ts: no Case,
 * no Mandate, no fee — the visitor copies and sends it to their employer
 * themselves.
 */

export interface FlsaWageStatementInput {
  employeeName: string;
  employerName: string;
  payPeriod: string;
  details?: string;
}

export function buildFlsaWageStatementLetter(input: FlsaWageStatementInput): {
  subject: string;
  body: string;
} {
  const name = input.employeeName.trim() || "[Your name]";
  const employer = input.employerName.trim() || "[Employer name]";
  const period = input.payPeriod.trim() || "[pay period]";
  const details = input.details?.trim();

  return {
    subject: `Request for wage statements and deduction detail — ${period}`,
    body: `${employer}
Payroll / Human Resources

I am ${name}.

Please provide itemized wage statements for ${period}, including regular rate, overtime, and every deduction, as required under the Fair Labor Standards Act and applicable state wage-and-hour law.

Where overtime or minimum wage was underpaid, please pay the shortfall and confirm the corrected method.
${details ? `\n${details}\n` : ""}
${name}`,
  };
}
