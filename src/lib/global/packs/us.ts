/**
 * United States — third jurisdiction pack.
 *
 * Focus: unclaimed property (the largest liquid recovery surface), federal tax
 * reconciliation, banking/overdraft, subscriptions, and energy bill review.
 * Amounts are conservative placeholders where a national fixed figure does not
 * exist; means-tested and state-varying rights stay unquantified rather than
 * invented. State-specific law lives in `extra` questions and letter fields,
 * not in the shared engine.
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

const RECIPIENTS: Record<string, string> = {
  irs: "Internal Revenue Service\nUnited States Department of the Treasury",
  state_tax: "{state} Department of Revenue\nTaxpayer Services",
  state_unclaimed: "{state} Unclaimed Property Division\nOffice of the State Treasurer",
  bank: "{counterparty}\nCustomer Relations / Office of the President",
  provider: "{counterparty}\nCustomer Care",
  energy: "{counterparty}\nBilling Department",
  employer: "{counterparty}\nPayroll / Human Resources",
  ssa: "Social Security Administration\nOffice of Public Inquiries",
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
  version: "2026.07.1",
  reviewed: "2026-07-27",
  docLocale: "en-US",
  currency: "USD",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
