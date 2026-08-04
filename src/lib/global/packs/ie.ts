/**
 * Ireland — a unitary state, so unlike the AU pack there is no
 * Commonwealth/state split to navigate: every right below rests on a single
 * national Act, regulation, or EU instrument directly applicable in Ireland,
 * and none of it depends on which county someone lives in.
 *
 * Every citation was checked against the Act/regulation text or the
 * administering body (Revenue, the Department of Social Protection, the
 * Workplace Relations Commission, the CCPC, the Central Bank of Ireland)
 * before being written here, on 2026-07-31. Amounts that genuinely vary by
 * individual circumstance (redundancy pay, means-tested benefits) are left
 * unquantified rather than guessed — this pack's own type (`RightDef.source`)
 * exists to make a fabricated citation or amount impossible to skip, and that
 * discipline is worth more than a longer-looking pack.
 */

import {
  always,
  is,
  num,
  oneOf,
  all,
  type JurisdictionPack,
  type Predicate,
  type RightCategory,
  type RightDef,
  type PackAction,
} from "../types";

const employee = oneOf("employment", "employee");
const working = oneOf("employment", "employee", "self_employed");
const parent = num("dependents", { gte: 1 });
const lowIncome = oneOf("incomeBand", "low");
const renting = oneOf("housing", "renting");

const RECIPIENTS: Record<string, string> = {
  revenue: "To\nRevenue Commissioners",
  dsp: "To\nDepartment of Social Protection",
  employer: "To\n{counterparty}\nPayroll / HR",
  provider: "To\n{counterparty}\nCustomer Service",
};

const IDENTITY = "I am {name}, PPS Number {id}.";

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
  right(
    "ie_statutory_redundancy",
    "work",
    employee,
    "Redundancy Payments Act 1967, s. 7 (entitlement) and s. 24 (time limit for claims), as amended",
    {
      kind: "letter",
      recipient: "employer",
      fields: ["period"],
      subject: "Statutory redundancy — request for payment and calculation",
      body: `${IDENTITY} My position was made redundant, and I ask you to confirm my statutory redundancy entitlement under the Redundancy Payments Acts, including the calculation used (two weeks' pay per year of service plus a bonus week, subject to the statutory weekly ceiling) for {period}.

If any amount remains unpaid, please arrange payment and confirm the date it will be made.`,
    },
  ),
  right(
    "ie_wages_unlawful_deduction",
    "work",
    employee,
    "Payment of Wages Act 1991, s. 5",
    {
      kind: "letter",
      recipient: "employer",
      fields: ["period", "details"],
      subject: "Request for wage records and review of a deduction — {period}",
      body: `${IDENTITY} A deduction was made from my wages, or an amount properly payable was not paid, for {period}: {details}.

Under section 5 of the Payment of Wages Act 1991 a deduction is unlawful unless required by statute, authorised by my contract in advance, or made with my prior written consent. Please provide the records showing the basis for this deduction, and repay any amount that does not meet those conditions.`,
    },
  ),
  right(
    "ie_minimum_wage_check",
    "work",
    employee,
    "National Minimum Wage Act 2000",
    {
      kind: "letter",
      recipient: "employer",
      fields: ["period"],
      subject: "Request for a statement of average hourly rate of pay",
      body: `${IDENTITY} Please provide a written statement of my average hourly rate of pay for the pay reference period {period}, as I am entitled to request under the National Minimum Wage Act 2000.

If that rate is below the national minimum wage applicable to me, please correct it and pay the shortfall.`,
    },
  ),
  right(
    "ie_consumer_remedy",
    "consumer",
    always,
    "Consumer Rights Act 2022 (No. 37 of 2022), Part 3 (consumer remedies in sale of goods contracts)",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty", "details"],
      subject: "Request for a remedy under the Consumer Rights Act 2022",
      body: `${IDENTITY} Goods or services I bought from you do not conform to the contract: {details}.

Under the Consumer Rights Act 2022 I am entitled to a repair, replacement, price reduction, or refund depending on when the issue arose. Please provide the appropriate remedy and confirm your response in writing.`,
    },
  ),
  right(
    "ie_cooling_off_cancellation",
    "consumer",
    always,
    "European Union (Consumer Information, Cancellation and Other Rights) Regulations 2013 (S.I. No. 484 of 2013), regs. 15–16",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["details"],
      subject: "Cancellation within the statutory cooling-off period",
      body: `${IDENTITY} I am cancelling the following contract, made at a distance or away from your business premises, within the cancellation period: {details}.

Under S.I. No. 484 of 2013 I am entitled to withdraw without giving any reason, within 14 days. Please confirm the cancellation and refund any amount paid, including standard delivery charges.`,
    },
  ),
  right(
    "ie_tenancy_deposit",
    "housing",
    renting,
    "Residential Tenancies Act 2004, s. 12(1)(d) (as amended by the Residential Tenancies (Amendment) Act 2015)",
    {
      kind: "letter",
      recipient: "provider",
      fields: ["counterparty"],
      subject: "Request for return of tenancy deposit",
      body: `${IDENTITY} My tenancy with you has ended and I ask you to return my deposit promptly, as required by section 12 of the Residential Tenancies Act 2004.

If any amount is being withheld, please set out the specific default relied on and the evidence for it, and return the remainder without delay.`,
    },
  ),
  right(
    "ie_child_benefit",
    "family",
    parent,
    "Social Welfare Consolidation Act 2005 (No. 26 of 2005), Part 4 (Child Benefit)",
    {
      kind: "letter",
      recipient: "dsp",
      subject: "Child Benefit — entitlement and payment review",
      body: `${IDENTITY} Please confirm my current Child Benefit entitlement and review whether any period has been underpaid or wrongly assessed.`,
    },
  ),
  right(
    "ie_illness_benefit",
    "social_security",
    working,
    "Social Welfare Consolidation Act 2005 (No. 26 of 2005) (Illness Benefit)",
    {
      kind: "letter",
      recipient: "dsp",
      subject: "Illness Benefit — claim status and rate review",
      body: `${IDENTITY} Please confirm the status of my Illness Benefit claim, the PRSI contribution record used to assess it, and review the rate awarded for correctness.`,
    },
  ),
  right(
    "ie_working_family_payment",
    "social_security",
    all(parent, working, lowIncome),
    "Social Welfare Consolidation Act 2005 (No. 26 of 2005) (Working Family Payment, formerly Family Income Supplement)",
    {
      kind: "letter",
      recipient: "dsp",
      subject: "Working Family Payment — entitlement check",
      body: `${IDENTITY} I am in low-paid employment with dependent children and wish to have my entitlement to Working Family Payment assessed, or my existing award reviewed for correctness.`,
    },
  ),
  right(
    "flight_comp_eu261",
    "consumer",
    always,
    "Regulation (EC) No 261/2004 (EU261)",
    { kind: "tool", tool: "/flights" },
  ),
  right(
    "recurring_charges_scan",
    "consumer",
    always,
    "Consumer Rights Act 2022 — digital content/service contract termination",
    { kind: "tool", tool: "/scan" },
  ),
  right(
    "bank_charges_review",
    "banking",
    always,
    "Central Bank of Ireland Consumer Protection Code 2025 (effective 24 March 2026)",
    { kind: "tool", tool: "/bank-fees" },
  ),
  right(
    "missing_refund",
    "consumer",
    always,
    "European Union (Payment Services) Regulations 2018 (S.I. No. 6 of 2018), reg. 97 — unauthorised/incorrect transaction refund",
    { kind: "tool", tool: "/refund-chase" },
  ),
];

export const IE_PACK: JurisdictionPack = {
  market: "IE",
  version: "2026.07.1",
  reviewed: "2026-07-31",
  docLocale: "en-IE",
  currency: "EUR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
