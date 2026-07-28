/** Canada — deepened 2026.07.3 data-only pack (conservative templates). */

import {
  always,
  any,
  is,
  num,
  oneOf,
  type JurisdictionPack,
  type Predicate,
  type RightCategory,
  type RightDef,
  type PackAction,
} from "../types";

const working = oneOf("employment", "employee", "self_employed");
const employee = oneOf("employment", "employee");
const parent = num("dependents", { gte: 1 });
const renting = oneOf("housing", "renting");
const owner = oneOf("housing", "owner");
const senior = any(num("ageYears", { gte: 65 }), oneOf("employment", "retired"));
const lowIncome = oneOf("incomeBand", "low");
const disability = is("hasDisability");
const student = oneOf("employment", "student");

const RECIPIENTS: Record<string, string> = {
  cra: "Canada Revenue Agency\n{municipality}",
  bank: "Complaints — {counterparty}",
  landlord: "{counterparty}",
  provider: "Customer service — {counterparty}",
  employer: "Payroll / HR — {counterparty}",
  energy: "Billing — {counterparty}",
  provincial: "Provincial benefits office\n{municipality}",
};

const IDENTITY = "I, {name}, reference {id}.";

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
  right("tax_review", "tax", working, "Income Tax Act — CRA", {
    kind: "letter",
    recipient: "cra",
    fields: ["period"],
    subject: "Request for review / refund — {period}",
    body: `${IDENTITY}\n\nPlease review my tax position for {period} and refund any overpayment.`,
  }),
  right("gst_hst_credit", "tax", any(lowIncome, parent), "Excise Tax Act — GST/HST credit", {
    kind: "letter",
    recipient: "cra",
    fields: ["period"],
    subject: "GST/HST credit — entitlement check",
    body: `${IDENTITY}\n\nPlease confirm my GST/HST credit entitlement and pay any missed instalments.`,
  }),
  right("canada_child_benefit", "family", parent, "Income Tax Act — Canada Child Benefit", {
    kind: "letter",
    recipient: "cra",
    subject: "Canada Child Benefit — review",
    body: `${IDENTITY}\n\nPlease confirm my Canada Child Benefit award and correct any underpayment.`,
  }),
  right("bank_fees", "banking", always, "FCAC — bank fee complaints", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "Fee dispute — account {accountNumber}",
    body: `${IDENTITY}\n\nPlease itemise and reverse unjustified fees on account {accountNumber}.`,
  }),
  right("deposit_return", "housing", renting, "Provincial tenancy law", {
    kind: "letter",
    recipient: "landlord",
    fields: ["counterparty", "details"],
    subject: "Return of security deposit",
    body: `${IDENTITY}\n\nThe tenancy has ended. Please return the deposit within the statutory period.\n\n{details}`,
  }),
  right("energy_bill", "energy", always, "Provincial utility rules", {
    kind: "letter",
    recipient: "energy",
    fields: ["counterparty", "accountNumber"],
    subject: "Bill review — {accountNumber}",
    body: `${IDENTITY}\n\nPlease review charges on contract {accountNumber} and refund any overbilling.`,
  }),
  right("cpp_oas_check", "social_security", senior, "Canada Pension Plan / Old Age Security", {
    kind: "letter",
    recipient: "cra",
    subject: "CPP / OAS — entitlement and underpayment review",
    body: `${IDENTITY}\n\nPlease confirm my CPP and OAS entitlements and pay any underpayment.`,
  }),
  right("ei_review", "work", employee, "Employment Insurance Act", {
    kind: "letter",
    recipient: "provincial",
    fields: ["period"],
    subject: "Employment Insurance — claim review — {period}",
    body: `${IDENTITY}\n\nPlease review my EI claim for {period} and correct any underpayment.`,
  }),
  right("wage_statement", "work", employee, "Canada Labour Code / provincial employment standards", {
    kind: "letter",
    recipient: "employer",
    fields: ["counterparty", "period"],
    subject: "Wage statement and overtime review — {period}",
    body: `${IDENTITY}\n\nPlease provide itemised wage statements for {period} and pay any overtime shortfall.`,
  }),
  right("disability_tax_credit", "health", disability, "Income Tax Act — Disability Tax Credit", {
    kind: "letter",
    recipient: "cra",
    subject: "Disability Tax Credit — application / review",
    body: `${IDENTITY}\n\nPlease advise on Disability Tax Credit eligibility and process any backdated claim.`,
  }),
  right("student_loan_overpay", "consumer", student, "Canada Student Loans — overpayment", {
    kind: "letter",
    recipient: "cra",
    subject: "Student loan overpayment — refund request",
    body: `${IDENTITY}\n\nPlease confirm any student-loan overpayment and refund the excess.`,
  }),
  right("mortgage_prepay", "housing", owner, "Bank Act / mortgage disclosure", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "Mortgage prepayment and penalty disclosure — {accountNumber}",
    body: `${IDENTITY}\n\nPlease provide the outstanding balance, prepayment options, and any penalty calculation for mortgage {accountNumber}.`,
  }),
  right("benefits_check", "family", any(parent, senior), "Government of Canada benefits", {
    kind: "tool",
    tool: "/what-am-i-owed",
  }),
  right("subs", "consumer", always, "Contract cancellation", {
    kind: "tool",
    tool: "/scan",
  }),
  right("bank_fees_tool", "banking", always, "FCAC fee complaints", {
    kind: "tool",
    tool: "/bank-fees",
  }),
];

export const CA_PACK: JurisdictionPack = {
  market: "CA",
  version: "2026.07.3",
  reviewed: "2026-07-28",
  docLocale: "en-CA",
  currency: "CAD",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
