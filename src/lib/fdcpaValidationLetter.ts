/**
 * FDCPA debt-validation letter — 15 U.S.C. § 1692g, the same citation
 * already registered in this codebase's US rights catalog
 * (src/lib/global/packs/us.ts, right id "fdcpa_debt_validation"). Purely a
 * self-serve letter draft, same tier as complaintEscalation.ts and
 * vaadBaitLetter.ts: no Case, no Mandate, no fee — the visitor copies and
 * sends it themselves.
 *
 * Deliberately never asks for a Social Security Number or any account
 * number the sender doesn't already know off-hand: 15 U.S.C. § 1692g does
 * not require disclosing one to request validation, and handing identifying
 * numbers to an unverified collector is a real identity-theft risk this
 * tool has no business creating.
 */

export interface FdcpaValidationInput {
  customerName: string;
  collectorName: string;
  referenceNumber?: string;
  details?: string;
}

export function buildFdcpaValidationLetter(input: FdcpaValidationInput): {
  subject: string;
  body: string;
} {
  const name = input.customerName.trim() || "[Your name]";
  const collector = input.collectorName.trim() || "[Collector name]";
  const reference = input.referenceNumber?.trim();
  const details = input.details?.trim();

  return {
    subject: "Debt validation request under 15 U.S.C. § 1692g",
    body: `${collector}
Disputes / Validation Requests

I am ${name}.${reference ? ` Your reference/account number: ${reference}.` : ""}

I dispute this debt and request validation under the Fair Debt Collection Practices Act, 15 U.S.C. § 1692g. Please provide:
1. The name and address of the original creditor
2. The amount owed, with an itemization showing how it was calculated
3. Verification that you are licensed to collect this debt in my state
${details ? `\n${details}\n` : ""}
Until validation is provided, please cease telephone contact and communicate with me in writing only.

${name}`,
  };
}
