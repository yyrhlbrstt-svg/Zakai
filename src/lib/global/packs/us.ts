/**
 * United States — third jurisdiction pack (deepened 2026.07.4).
 *
 * Focus: unclaimed property (the largest liquid recovery surface), federal tax
 * reconciliation, banking/overdraft, subscriptions, energy, student loans,
 * and SSA underpayment. Amounts are conservative placeholders where a national
 * fixed figure does not exist; means-tested and state-varying rights stay
 * unquantified rather than invented.
 *
 * Nothing in engine.ts changed to add this file.
 */

import {
  all,
  always,
  any,
  is,
  not,
  num,
  oneOf,
  type JurisdictionPack,
  type Predicate,
  type RightCategory,
  type RightDef,
  type PackAction,
} from "../types";

const senior = any(num("ageYears", { gte: 65 }), oneOf("employment", "retired"));
const employee = oneOf("employment", "employee");
const working = oneOf("employment", "employee", "self_employed");
const parent = num("dependents", { gte: 1 });
const lowIncome = oneOf("incomeBand", "low");
const renting = oneOf("housing", "renting");
const owner = oneOf("housing", "owner");
const disability = is("hasDisability");
const student = oneOf("employment", "student");

const RECIPIENTS: Record<string, string> = {
  irs: "Internal Revenue Service\nUnited States Department of the Treasury",
  state_tax: "{state} Department of Revenue\nTaxpayer Services",
  state_unclaimed: "{state} Unclaimed Property Division\nOffice of the State Treasurer",
  bank: "{counterparty}\nCustomer Relations / Office of the President",
  provider: "{counterparty}\nCustomer Care",
  energy: "{counterparty}\nBilling Department",
  employer: "{counterparty}\nPayroll / Human Resources",
  ssa: "Social Security Administration\nOffice of Public Inquiries",
  studentaid: "U.S. Department of Education\nFederal Student Aid",
  debt_collector: "{counterparty}\nDisputes / Validation Requests",
};

const IDENTITY =
  "I am {name}. My taxpayer identification (last four of SSN or ITIN) is {id}.";

function right(
  id: string,
  category: RightCategory,
  when: Predicate,
  source: string,
  action: PackAction,
  amounts: { yearlyMinor?: number; oneTimeMinor?: number } = {},
): RightDef {
  return { id, category, when, source, action, ...amounts };
}

const rights: RightDef[] = [
  // ---- Unclaimed property (core US recovery surface) ---------------------
  right(
    "state_unclaimed_property",
    "banking",
    always,
    "Uniform Unclaimed Property Act (revised) as adopted by the relevant state; state treasury unclaimed property statutes",
    {
      kind: "letter",
      recipient: "state_unclaimed",
      fields: ["state", "details"],
      subject: "Claim for unclaimed property held by the State of {state}",
      body: `${IDENTITY} I believe property belonging to me — or to a relative for whom I am a lawful claimant — is held as unclaimed property by the State of {state}.\n\nPlease search under my name and the variations listed below, provide claim forms for any matches, and confirm the documentation required to complete payment: {details}.`,
    },
  ),
  right(
    "bank_abandoned_funds",
    "banking",
    always,
    "State unclaimed property law; 12 U.S.C. banking safety-and-soundness norms for escheat of dormant deposits",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Request for dormant-account and escheat history — {accountNumber}",
      body: `${IDENTITY} Please provide a full history of any accounts held in my name, including accounts closed or escheated to a state as abandoned property, for the longest period your records allow.\n\nWhere funds were remitted to a state treasury, please confirm the state, the amount, and the date of remittance so that I may file a claim.`,
    },
  ),

  // ---- Tax -----------------------------------------------------------------
  right(
    "federal_tax_refund_status",
    "tax",
    working,
    "Internal Revenue Code; IRS refund procedures",
    {
      kind: "letter",
      recipient: "irs",
      fields: ["period"],
      subject: "Request for refund status and account transcript — tax year {period}",
      body: `${IDENTITY} Please provide the status of any refund due for tax year {period}, a wage and income transcript, and an account transcript for that year.\n\nIf a refund was issued to a closed account or is held pending identity verification, please state the corrective steps and the expected timeline.`,
    },
  ),
  right(
    "earned_income_tax_credit",
    "tax",
    all(working, lowIncome, any(parent, always)),
    "IRC §32 (Earned Income Tax Credit)",
    {
      kind: "letter",
      recipient: "irs",
      fields: ["period"],
      subject: "Earned Income Tax Credit — claim or amended return for {period}",
      body: `${IDENTITY} I believe I qualify for the Earned Income Tax Credit for tax year {period} and either did not claim it or under-claimed it.\n\nPlease advise whether an amended return (Form 1040-X) is required, and confirm the credit amount once the claim is processed.`,
    },
  ),
  right(
    "child_tax_credit",
    "tax",
    parent,
    "IRC §24 (Child Tax Credit)",
    {
      kind: "letter",
      recipient: "irs",
      fields: ["period"],
      subject: "Child Tax Credit — review for tax year {period}",
      body: `${IDENTITY} Please confirm whether the full Child Tax Credit was applied for tax year {period} for each qualifying child in my household.\n\nIf any portion remains unpaid, please process the remainder or explain the adjustment.`,
    },
  ),
  right(
    "state_tax_refund",
    "tax",
    working,
    "Applicable state income-tax refund statutes",
    {
      kind: "letter",
      recipient: "state_tax",
      fields: ["state", "period"],
      subject: "State income-tax refund inquiry — {state}, year {period}",
      body: `${IDENTITY} Please confirm the status of any state income-tax refund due for {period}, including offsets applied to other debts and the net amount still payable.`,
    },
  ),

  // ---- Banking / consumer --------------------------------------------------
  right(
    "overdraft_fee_review",
    "banking",
    always,
    "CFPB overdraft rulemaking; Regulation E; state unfair-practices statutes",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Request for overdraft and NSF fee history — account {accountNumber}",
      body: `${IDENTITY} Please provide a schedule of all overdraft, NSF, and related fees assessed on account {accountNumber} for the last seven years.\n\nWhere fees were assessed in a manner inconsistent with your published disclosures or applicable federal guidance, please refund them and confirm the credit in writing.`,
    },
  ),
  right(
    "subscription_audit",
    "consumer",
    always,
    "Electronic Fund Transfer Act; Regulation E; state automatic-renewal laws",
    { kind: "tool", tool: "/scan" },
  ),
  right(
    "credit_card_billing_error",
    "consumer",
    always,
    "Fair Credit Billing Act; Regulation Z, billing-error procedures",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty", "accountNumber", "details"],
      subject: "Billing error notice under the Fair Credit Billing Act — {accountNumber}",
      body: `${IDENTITY} This is a billing-error notice concerning account {accountNumber}.\n\n{details}\n\nPlease acknowledge within the statutory period, investigate, and either correct the error or explain in writing why the charge is correct.`,
    },
  ),
  right(
    "credit_report_dispute",
    "consumer",
    always,
    "Fair Credit Reporting Act; 15 U.S.C. §1681i",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty", "details"],
      subject: "Dispute of inaccurate information on consumer report",
      body: `${IDENTITY} Under the Fair Credit Reporting Act I dispute the following items appearing on my consumer report: {details}.\n\nPlease investigate and correct or delete any information that cannot be verified as accurate and complete.`,
    },
  ),

  // ---- Energy --------------------------------------------------------------
  right(
    "utility_billing_review",
    "energy",
    always,
    "State public-utility commission consumer rules; contract and unjust-enrichment principles",
    {
      kind: "letter",
      recipient: "energy",
      fields: ["counterparty", "accountNumber"],
      subject: "Request for a full billing history and credit refund — {accountNumber}",
      body: `${IDENTITY} Please provide a complete billing history for account {accountNumber}, including estimated versus actual readings and any deposits held.\n\nPlease refund any credit balance and correct charges that later actual readings show were overstated.`,
    },
  ),
  right(
    "liheap_energy_assistance",
    "energy",
    lowIncome,
    "Low Income Home Energy Assistance Act (42 U.S.C. §8621 et seq.)",
    {
      kind: "letter",
      recipient: "energy",
      fields: ["counterparty", "accountNumber", "state"],
      subject: "LIHEAP / energy assistance — account {accountNumber}",
      body: `${IDENTITY} I wish to apply for energy assistance available in {state} for account {accountNumber}, including LIHEAP where administered locally.\n\nPlease confirm eligibility criteria, required documents, and whether a crisis benefit is available.`,
    },
  ),

  // ---- Social / senior -----------------------------------------------------
  right(
    "ssa_benefit_verification",
    "social_security",
    any(senior, disability),
    "Social Security Act; 20 C.F.R. Part 404",
    {
      kind: "letter",
      recipient: "ssa",
      subject: "Request for benefit verification and underpayment review",
      body: `${IDENTITY} Please provide a benefit verification letter and confirm whether any underpayment or delayed cost-of-living adjustment remains unpaid on my record.\n\nIf an application for benefits was filed and not fully processed, please state the current status and next steps.`,
    },
  ),
  right(
    "ssa_underpayment",
    "social_security",
    any(senior, disability),
    "Social Security Act §204; 20 C.F.R. §404.501 et seq.",
    {
      kind: "letter",
      recipient: "ssa",
      subject: "Request for underpayment review and payment of amounts due",
      body: `${IDENTITY} I request a full review of my earnings record and benefit history for any underpayment still due.\n\nPlease calculate and pay any amounts owed, including retroactive adjustments, and confirm the basis of the calculation in writing.`,
    },
  ),

  // ---- Student / education -------------------------------------------------
  right(
    "student_loan_forgiveness_inquiry",
    "consumer",
    any(student, working),
    "Higher Education Act; Federal Student Aid forgiveness and discharge programs",
    {
      kind: "letter",
      recipient: "studentaid",
      fields: ["details"],
      subject: "Inquiry regarding federal student loan forgiveness or discharge eligibility",
      body: `${IDENTITY} I hold federal student loans and wish to confirm whether I qualify for any forgiveness, cancellation, or discharge program currently available (including Public Service Loan Forgiveness, borrower-defense, total and permanent disability, or closed-school discharge).\n\n{details}\n\nPlease confirm my eligibility status, required forms, and the next steps to apply.`,
    },
  ),
  right(
    "student_loan_overpayment",
    "consumer",
    any(student, working),
    "Higher Education Act; 34 C.F.R. Part 682 / 685",
    {
      kind: "letter",
      recipient: "studentaid",
      subject: "Request for refund of student-loan overpayment",
      body: `${IDENTITY} I believe I have overpaid on one or more federal student loans.\n\nPlease confirm the current payoff balance, any credit balance, and the process to receive a refund of amounts paid in excess of the amount owed.`,
    },
  ),

  // ---- Work ----------------------------------------------------------------
  right(
    "wage_statement_audit",
    "work",
    employee,
    "Fair Labor Standards Act; applicable state wage-and-hour law",
    {
      kind: "letter",
      recipient: "employer",
      fields: ["counterparty", "period"],
      subject: "Request for wage statements and deduction detail — {period}",
      body: `${IDENTITY} Please provide itemized wage statements for {period}, including regular rate, overtime, and every deduction.\n\nWhere overtime or minimum wage was underpaid, please pay the shortfall and confirm the corrected method.`,
    },
  ),
  right(
    "fdcpa_debt_validation",
    "consumer",
    always,
    "15 U.S.C. § 1692g (Fair Debt Collection Practices Act — validation of debts)",
    {
      kind: "letter",
      recipient: "debt_collector",
      fields: ["counterparty", "details"],
      subject: "Debt validation request under 15 U.S.C. § 1692g",
      body: `${IDENTITY} I dispute the debt and request validation under the Fair Debt Collection Practices Act.\n\nPlease provide the name and address of the original creditor, the amount owed with an itemization showing how it was calculated, and verification that you are licensed to collect in my state.\n\n{details}\n\nUntil validation is provided, please cease telephone contact and communicate in writing only.`,
    },
    { oneTimeMinor: 1_000_00 },
  ),
  right(
    "credit_freeze_request",
    "consumer",
    always,
    "Fair Credit Reporting Act; 15 U.S.C. § 1681c-1 (security freezes)",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty"],
      subject: "Request to place a security freeze on my consumer report",
      body: `${IDENTITY} Under 15 U.S.C. § 1681c-1 I request that you place a security freeze on my consumer file.\n\nPlease confirm the freeze in writing, provide any PIN or password required to lift it, and confirm that the freeze is free of charge as required by federal law.`,
    },
  ),
  right(
    "tcpa_stop_calls",
    "consumer",
    always,
    "Telephone Consumer Protection Act; 47 U.S.C. § 227; FCC implementing rules",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty", "details"],
      subject: "Revocation of consent — cease autodialed and prerecorded calls",
      body: `${IDENTITY} I revoke any consent to receive autodialed, prerecorded, or artificial-voice calls or texts from you or your agents.\n\n{details}\n\nPlease confirm in writing that my number has been removed from all calling and texting campaigns within the period required by the TCPA and FCC rules.`,
    },
  ),

  // ---- Housing -------------------------------------------------------------
  right(
    "security_deposit_return",
    "housing",
    renting,
    "Applicable state residential landlord-tenant security-deposit statutes",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty", "details"],
      subject: "Demand for return of residential security deposit",
      body: `${IDENTITY} My tenancy has ended. Please return the security deposit, or provide an itemized statement of lawful deductions, within the period required by state law.\n\n{details}\n\nIf the deposit is not returned as required, I will pursue the statutory remedies available in my state.`,
    },
  ),
  right(
    "mortgage_escrow_surplus",
    "housing",
    owner,
    "Real Estate Settlement Procedures Act; Regulation X escrow rules",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Escrow account analysis and surplus refund — {accountNumber}",
      body: `${IDENTITY} Please provide the current escrow analysis for mortgage account {accountNumber} and refund any surplus above the permitted cushion.\n\nPlease also confirm the projected disbursements for the next computation year.`,
    },
  ),
];

export const US_PACK: JurisdictionPack = {
  market: "US",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "en-US",
  currency: "USD",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
