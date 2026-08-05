/**
 * United Kingdom — the second jurisdiction, and the actual test of the
 * architecture.
 *
 * Nothing in `engine.ts` or `types.ts` changed to add this country. No new
 * component, no new route, no branch on `market === "GB"` anywhere. If that
 * had not held, the abstraction would have been decoration and the honest move
 * would have been to say so.
 *
 * Everything that varies between countries varies here as data: the currency
 * and its minor units, the retirement threshold (66, not Israel's 67), the
 * bodies letters are addressed to, the language those letters are written in,
 * and the statutes each right rests on.
 *
 * Amounts are given only where a headline figure is set nationally and stable;
 * everything means-tested is left unquantified rather than guessed. Figures are
 * indicative of the 2025/26 rates and are re-checked on each `reviewed` bump —
 * which is exactly why `version` and `reviewed` are on the pack rather than in
 * a comment.
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

/** UK State Pension age. The equivalent constant in the IL pack is 67. */
const PENSION_AGE = 66;

const senior = any(num("ageYears", { gte: PENSION_AGE }), oneOf("employment", "retired"));
const employee = oneOf("employment", "employee");
const working = oneOf("employment", "employee", "self_employed");
const parent = num("dependents", { gte: 1 });
const toddlerParent = num("dependentsUnder6", { gte: 1 });
const lowIncome = oneOf("incomeBand", "low");
const renting = oneOf("housing", "renting");
const owner = oneOf("housing", "owner");
const disability = is("hasDisability");
const student = oneOf("employment", "student");
const partnered = is("partnered");

const RECIPIENTS: Record<string, string> = {
  hmrc: "To\nHM Revenue & Customs\nPay As You Earn and Self Assessment",
  dwp: "To\nDepartment for Work and Pensions",
  council: "To\nCouncil Tax and Benefits Service\n{municipality} Council",
  bank: "To\n{counterparty}\nCustomer Relations",
  provider: "To\n{counterparty}\nCustomer Services",
  employer: "To\n{counterparty}\nPayroll / People Team",
  pension_provider: "To\n{counterparty}\nMember Services",
  energy_supplier: "To\n{counterparty}\nCustomer Services",
  childcare_service: "To\nChildcare Service\nHM Revenue & Customs",
  nhs_bsa: "To\nNHS Business Services Authority\nHelp with Health Costs",
  slc: "To\nStudent Loans Company\n100 Bothwell Street\nGlasgow G2 7JD",
};

const IDENTITY = "I am {name}, National Insurance number {id}.";

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
  // ---- Tax -----------------------------------------------------------------
  right(
    "marriage_allowance",
    "tax",
    all(partnered, working),
    "Income Tax Act 2007, ss. 55A–55E",
    {
      kind: "letter",
      recipient: "hmrc",
      fields: ["period"],
      subject: "Marriage Allowance — application and backdated claim",
      body: `${IDENTITY} My spouse or civil partner and I meet the conditions for Marriage Allowance, and I wish to transfer the permitted portion of the personal allowance between us.

Please apply the allowance for the current tax year and backdate the claim across all years still open for amendment, and confirm in writing the amount repayable and the revised tax codes.`,
    },
    { yearlyMinor: 25_200 },
  ),
  right(
    "employment_expenses_relief",
    "tax",
    employee,
    "Income Tax (Earnings and Pensions) Act 2003, s. 336 (deductions for expenses: the general rule)",
    {
      kind: "letter",
      recipient: "hmrc",
      fields: ["period", "details"],
      subject: "Claim for tax relief on employment expenses",
      body: `${IDENTITY} I have incurred expenses wholly, exclusively and necessarily in the performance of my duties of employment, which my employer has not reimbursed: {details}.

Please allow the relief due for the current tax year and for all earlier years still within the time limit for claims, adjust my tax code accordingly, and confirm the repayment due.`,
    },
  ),
  right(
    "tax_overpayment_review",
    "tax",
    working,
    "Taxes Management Act 1970, Sch. 1AB (overpayment relief)",
    {
      kind: "letter",
      recipient: "hmrc",
      fields: ["period"],
      subject: "Request for a review of overpaid income tax — {period}",
      body: `${IDENTITY} I believe income tax has been overpaid, whether through an incorrect tax code, employment ending part-way through a year, or unclaimed reliefs.

Please carry out a reconciliation for the years still open, issue the resulting calculation, and repay any amount overpaid.`,
    },
  ),
  right(
    "pension_tax_relief_higher_rate",
    "tax",
    all(working, oneOf("incomeBand", "high")),
    "Finance Act 2004, s. 192 (relief at source) and s. 188",
    {
      kind: "letter",
      recipient: "hmrc",
      fields: ["period"],
      subject: "Claim for higher-rate relief on personal pension contributions",
      body: `${IDENTITY} I have made personal pension contributions on which relief has been given only at the basic rate.

Please give the additional relief due at my marginal rate for the current and all open earlier years, and confirm the repayment and any tax-code adjustment.`,
    },
  ),

  // ---- Council tax ---------------------------------------------------------
  right(
    "council_tax_single_person",
    "municipal",
    all(not(partnered), num("dependents", { lte: 0 })),
    "Local Government Finance Act 1992, s. 11(1)",
    {
      kind: "letter",
      recipient: "council",
      fields: ["municipality", "accountNumber"],
      subject: "Application for the single person discount on council tax",
      body: `${IDENTITY} I am the sole resident adult at the property held under council tax account {accountNumber}.

Please apply the 25% single person discount, backdate it to the date the sole occupancy began, and credit any amount overpaid to my account.`,
    },
    { yearlyMinor: 45_000 },
  ),
  right(
    "council_tax_reduction",
    "municipal",
    lowIncome,
    "Local Government Finance Act 1992, s. 13A(2) and Schedule 1A (local Council Tax Reduction scheme)",
    {
      kind: "letter",
      recipient: "council",
      fields: ["municipality", "accountNumber"],
      subject: "Application for Council Tax Reduction",
      body: `${IDENTITY} I wish to apply for Council Tax Reduction under your local scheme for account {accountNumber}.

Please confirm the evidence required, assess the application from the earliest date allowed, and issue a written decision setting out the reduction awarded and the right of appeal.`,
    },
  ),
  right(
    "council_tax_disability_band",
    "municipal",
    disability,
    "Council Tax (Reductions for Disabilities) Regulations 1992",
    {
      kind: "letter",
      recipient: "council",
      fields: ["municipality", "accountNumber"],
      subject: "Application for the disabled band reduction scheme",
      body: `${IDENTITY} The property under account {accountNumber} has features required to meet the needs of a disabled resident.

Please assess entitlement under the disabled band reduction scheme, backdate the reduction to the date the qualifying feature was in use, and refund the resulting overpayment.`,
    },
  ),
  right(
    "council_tax_student_exemption",
    "municipal",
    student,
    "Local Government Finance Act 1992, Sch. 1 para. 4",
    {
      kind: "letter",
      recipient: "council",
      fields: ["municipality", "accountNumber"],
      subject: "Application for student exemption or discount from council tax",
      body: `${IDENTITY} I am a full-time student resident at the property held under account {accountNumber}.

Please apply the exemption or discount due, backdate it to the start of my course, and refund any council tax paid for that period.`,
    },
  ),

  // ---- Social security -----------------------------------------------------
  right(
    "child_benefit",
    "social_security",
    parent,
    "Social Security Contributions and Benefits Act 1992, Part IX",
    {
      kind: "letter",
      recipient: "hmrc",
      subject: "Child Benefit — claim and National Insurance credits",
      body: `${IDENTITY} I am responsible for a child and wish to claim Child Benefit, or to confirm my existing award is correct.

Where the High Income Child Benefit Charge applies, please register the claim for National Insurance credit purposes even if payment is not taken. Please confirm the award and the credits recorded.`,
    },
    { yearlyMinor: 135_400 },
  ),
  right(
    "universal_credit",
    "social_security",
    lowIncome,
    "Welfare Reform Act 2012, Part 1",
    {
      kind: "letter",
      recipient: "dwp",
      subject: "Universal Credit — entitlement check and award review",
      body: `${IDENTITY} I wish to have my entitlement to Universal Credit assessed, including any housing, childcare and disability elements that apply to my circumstances.

Please confirm the evidence required and issue a written decision setting out each element awarded and the right to request a mandatory reconsideration.`,
    },
  ),
  right(
    "pension_credit",
    "social_security",
    all(senior, lowIncome),
    "State Pension Credit Act 2002",
    {
      kind: "letter",
      recipient: "dwp",
      subject: "Pension Credit — claim and backdating request",
      body: `${IDENTITY} I wish to claim Pension Credit, including Guarantee Credit and, where applicable, Savings Credit.

Please backdate the claim to the earliest date permitted, and confirm in writing the amount awarded and the passported entitlements that follow from it.`,
    },
  ),
  right(
    "attendance_allowance",
    "social_security",
    all(num("ageYears", { gte: PENSION_AGE }), disability),
    "Social Security Contributions and Benefits Act 1992, s. 64",
    {
      kind: "letter",
      recipient: "dwp",
      subject: "Attendance Allowance — request to claim",
      body: `${IDENTITY} I have care needs arising from a disability or long-term health condition and wish to claim Attendance Allowance.

Please send the claim form, treat this letter as fixing the date of claim, and confirm the rate awarded together with the right of appeal.`,
    },
  ),
  right(
    "personal_independence_payment",
    "social_security",
    all(disability, num("ageYears", { gte: 16, lte: PENSION_AGE - 1 })),
    "Welfare Reform Act 2012, Part 4",
    {
      kind: "letter",
      recipient: "dwp",
      subject: "Personal Independence Payment — request to claim",
      body: `${IDENTITY} I wish to claim Personal Independence Payment in respect of the daily living and mobility difficulties caused by my condition.

Please register the date of this letter as the date of claim, and confirm the components and rates awarded together with the mandatory reconsideration rights.`,
    },
  ),
  right(
    "state_pension_gaps",
    "social_security",
    num("ageYears", { gte: 45 }),
    "Pensions Act 2014, Part 1 and Social Security (Contributions) Regulations 2001",
    {
      kind: "letter",
      recipient: "hmrc",
      subject: "State Pension forecast and National Insurance record",
      body: `${IDENTITY} Please provide my full National Insurance contribution record and State Pension forecast, identifying any incomplete qualifying years.

Where gaps exist, please confirm which years may still be filled by voluntary contributions, the cost of each, and the deadline that applies.`,
    },
  ),
  right(
    "winter_fuel_payment",
    "social_security",
    senior,
    "Social Fund Winter Fuel Payment Regulations 2000",
    {
      kind: "letter",
      recipient: "dwp",
      subject: "Winter Fuel Payment — entitlement enquiry",
      body: `${IDENTITY} Please confirm my entitlement to the Winter Fuel Payment for the current and preceding winters, and whether any qualifying benefit is required in my case.

Where payment was due but not made, please arrange payment and explain the reason for the omission.`,
    },
  ),

  // ---- Energy --------------------------------------------------------------
  right(
    "warm_home_discount",
    "energy",
    any(lowIncome, all(senior, lowIncome)),
    "Warm Home Discount Regulations 2022",
    {
      kind: "letter",
      recipient: "energy_supplier",
      fields: ["counterparty", "accountNumber"],
      subject: "Warm Home Discount — application for account {accountNumber}",
      body: `${IDENTITY} I hold energy account {accountNumber} and believe I fall within a qualifying group for the Warm Home Discount.

Please confirm whether the rebate has been applied for the current scheme year, apply it if not, and set out the eligibility criteria you have used.`,
    },
    { yearlyMinor: 15_000 },
  ),
  right(
    "energy_billing_review",
    "energy",
    always,
    "Ofgem Standard Licence Conditions 21B (billing based on meter readings), 21BA (backbilling) and 4D (credit balance protection); Limitation Act 1980, s. 5",
    {
      kind: "letter",
      recipient: "energy_supplier",
      fields: ["counterparty", "accountNumber"],
      subject: "Request for a billing review and refund of credit balance",
      body: `${IDENTITY} Please provide a full statement for account {accountNumber} covering the last six years, including every tariff applied and every estimated reading used.

Please refund any credit balance held, and correct any charge based on an estimate that a later actual reading has shown to be wrong.`,
    },
  ),

  // ---- Consumer — wired to agent tools ------------------------------------
  right(
    "flight_comp_uk261",
    "consumer",
    always,
    "Retained Regulation (EC) No 261/2004, as it forms part of UK domestic law",
    { kind: "tool", tool: "/flights" },
  ),
  right(
    "subscription_audit",
    "consumer",
    always,
    "Consumer Rights Act 2015; Payment Services Regulations 2017, reg. 67 (withdrawal of consent to a continuous payment authority)",
    { kind: "tool", tool: "/cancel" },
  ),
  right(
    "bank_charges_review",
    "banking",
    always,
    "FCA Handbook, BCOBS and CONC 5D (persistent debt and overdraft charges)",
    { kind: "tool", tool: "/bank-fees" },
  ),
  right(
    "missing_refund",
    "consumer",
    always,
    "Consumer Rights Act 2015; Payment Services Regulations 2017",
    { kind: "tool", tool: "/refund-chase" },
  ),
  right(
    "mortgage_refinance",
    "housing",
    owner,
    "FCA Handbook, MCOB 7 and MCOB 11",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Mortgage account {accountNumber} — redemption figure and retention offer",
      body: `${IDENTITY} Please provide the outstanding balance, the current product and rate, the date any fixed period ends, and the early repayment charge applicable today for mortgage account {accountNumber}.

Please also set out the product transfer options available to me at present. I am comparing them against the wider market.`,
    },
  ),
  right(
    "pension_fees",
    "consumer",
    working,
    "Occupational Pension Schemes (Charges and Governance) Regulations 2015",
    {
      kind: "letter",
      recipient: "pension_provider",
      fields: ["counterparty", "accountNumber"],
      subject: "Request for a full charges disclosure — member {accountNumber}",
      body: `${IDENTITY} Please provide the total annual charge applied to my pension, broken down into the annual management charge, fund and transaction costs, and any policy fee.

Please also confirm whether a lower-cost share class or default arrangement is available to me, and the effect of moving to it.`,
    },
  ),

  // ---- Family --------------------------------------------------------------
  right(
    "free_childcare_hours",
    "family",
    all(toddlerParent, working),
    "Childcare Act 2016 and the Childcare (Free of Charge for Working Parents) Regulations",
    {
      kind: "letter",
      recipient: "childcare_service",
      subject: "Application for funded childcare hours for a working parent",
      body: `${IDENTITY} I am a working parent of a child of eligible age and wish to obtain the eligibility code for the funded childcare hours.

Please confirm the hours I qualify for, the term from which they take effect, and the reconfirmation cycle that applies.`,
    },
  ),
  right(
    "tax_free_childcare",
    "family",
    all(toddlerParent, working),
    "Childcare Payments Act 2014",
    {
      kind: "letter",
      recipient: "childcare_service",
      subject: "Tax-Free Childcare — account and top-up enquiry",
      body: `${IDENTITY} Please confirm my eligibility for Tax-Free Childcare and open the childcare account, so that the government top-up is applied to my qualifying childcare costs.

Please also confirm how this interacts with any Universal Credit childcare element I may claim, so that I take the more advantageous option.`,
    },
  ),

  // ---- Health --------------------------------------------------------------
  right(
    "nhs_low_income_scheme",
    "health",
    lowIncome,
    "National Health Service Act 2006, s. 180 and the NHS (Travel Expenses and Remission of Charges) Regulations 2003",
    {
      kind: "letter",
      recipient: "nhs_bsa",
      subject: "Application under the NHS Low Income Scheme",
      body: `${IDENTITY} I wish to apply for help with health costs under the Low Income Scheme, including prescription, dental, optical and travel costs.

Please assess my entitlement, issue the appropriate certificate, and confirm whether costs already paid within the refund period may be reclaimed.`,
    },
  ),

  // ---- Work ----------------------------------------------------------------
  right(
    "workplace_pension_check",
    "work",
    employee,
    "Pensions Act 2008, Part 1 (automatic enrolment)",
    {
      kind: "letter",
      recipient: "employer",
      fields: ["counterparty"],
      subject: "Automatic enrolment — request for a contribution statement",
      body: `${IDENTITY} Please provide a statement of the pension contributions deducted from my pay and those paid by the employer, together with the dates each was remitted to the scheme.

Where any contribution was not paid at the correct rate or on time, please correct it and confirm the correction in writing.`,
    },
  ),
  right(
    "holiday_pay_review",
    "work",
    employee,
    "Working Time Regulations 1998; Employment Rights Act 1996, Part II",
    {
      kind: "letter",
      recipient: "employer",
      fields: ["counterparty", "period"],
      subject: "Request for a holiday pay and deductions review — {period}",
      body: `${IDENTITY} Please provide a breakdown of how my holiday entitlement and holiday pay have been calculated, including the treatment of regular overtime, commission and allowances in the rate used.

Where the calculation has produced an underpayment, please pay the shortfall and confirm the corrected method going forward.`,
    },
  ),

  // ---- Education / student finance -----------------------------------------
  right(
    "student_loan_overpayment",
    "education",
    student,
    "Education (Student Loans) Regulations 1998 (repayment account); Student Loans Company published repayment guidance",
    {
      kind: "letter",
      recipient: "slc",
      fields: ["details"],
      subject: "Request for refund of student loan overpayment",
      body: `${IDENTITY} I believe repayments have continued after my loan balance was cleared, or that an incorrect balance has caused me to overpay.

Plan and account details: {details}

Please confirm the current balance, any credit balance on the account, and repay any sum paid in excess of the amount properly due.`,
    },
    { oneTimeMinor: 24_000 },
  ),

  // ---- Housing -------------------------------------------------------------
  right(
    "tenancy_deposit_check",
    "housing",
    renting,
    "Housing Act 2004, ss. 213–215 (tenancy deposit protection)",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty"],
      subject: "Tenancy deposit — request for protection details",
      body: `${IDENTITY} Please confirm which authorised tenancy deposit scheme holds my deposit, the date it was protected, and provide the prescribed information required by statute.

If the deposit was not protected within the statutory period, please confirm how you propose to remedy that.`,
    },
  ),
  // ---- Banking depth (institutional surface for UK bank pilots) ------------
  right(
    "app_fraud_refund_claim",
    "banking",
    always,
    "PSR Specific Direction 20 (Faster Payments) / 21 (CHAPS) — mandatory APP scam reimbursement, effective 7 October 2024 (supersedes the voluntary CRM Code for in-scope payments)",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber", "details"],
      subject: "Authorised push payment scam — mandatory reimbursement claim — account {accountNumber}",
      body: `${IDENTITY} I was deceived into authorising a payment from account {accountNumber}. Particulars: {details}

This payment falls under the PSR's mandatory APP scam reimbursement requirement (in force since 7 October 2024). Please assess my claim under that scheme, confirm the outcome in writing, and set out any excess applied and the refund timeline.`,
    },
  ),
  right(
    "basic_bank_account_access",
    "banking",
    always,
    "Payment Accounts Regulations 2015, Part 4 (access to a payment account with basic features)",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty"],
      subject: "Request for a payment account with basic features",
      body: `${IDENTITY} Please confirm whether you offer a payment account with basic features under the Payment Accounts Regulations 2015 and, if so, the eligibility criteria, fees, and how I may open one.

If you refuse, please state the lawful ground for refusal in writing.`,
    },
  ),
  right(
    "dormant_account_unclaimed",
    "banking",
    always,
    "Dormant Bank and Building Society Accounts Act 2008; reclaim process administered via reclaim funds / participating institutions",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber", "details"],
      subject: "Reclaim enquiry — possible dormant account balance",
      body: `${IDENTITY} I believe funds belonging to me (or to a person for whom I am a lawful claimant) may be held in a dormant account with you. Account or identifying details: {accountNumber}. Further particulars: {details}

Please search your records, confirm any reclaimable balance, and provide the forms required to complete repayment.`,
    },
  ),
  right(
    "persistent_overdraft_review",
    "banking",
    always,
    "FCA Handbook, CONC 5D (persistent debt) and BCOBS (overdraft charges and communications)",
    {
      kind: "letter",
      recipient: "bank",
      fields: ["counterparty", "accountNumber"],
      subject: "Persistent overdraft / arranged overdraft review — account {accountNumber}",
      body: `${IDENTITY} Please provide a schedule of overdraft interest and charges on account {accountNumber} for the last 12 months, confirm whether I have been treated under the persistent debt rules in CONC 5D, and set out cheaper alternatives or forbearance options available to me.`,
    },
  ),

];

export const GB_PACK: JurisdictionPack = {
  market: "GB",
  version: "2026.08.2",
  reviewed: "2026-08-03",
  docLocale: "en-GB",
  currency: "GBP",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
