/** India — consumer / banking / PF letters. English. */
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
const parent = num("dependents", { gte: 1 });
const renting = oneOf("housing", "renting");
const lowIncome = oneOf("incomeBand", "low");
const disability = is("hasDisability");
const senior = any(num("ageYears", { gte: 60 }), oneOf("employment", "retired"));

const RECIPIENTS: Record<string, string> = {
  epfo: "Employees' Provident Fund Organisation\n{municipality}",
  bank: "{counterparty}\nCustomer Care / Grievance",
  trader: "{counterparty}\nCustomer Care",
  landlord: "{counterparty}",
};

const IDENTITY = "I am {name}. My PAN / Aadhaar reference (last four) is {id}.";

function right(
  id: string,
  category: RightCategory,
  when: Predicate,
  source: string,
  action: PackAction,
): RightDef {
  return { id, category, when, source, action };
}

const rights: RightDef[] = [
  right("in_epf_status", "work", working, "Employees' Provident Funds and Miscellaneous Provisions Act, 1952", {
    kind: "letter",
    recipient: "epfo",
    fields: ["municipality", "details"],
    subject: "EPF account — statement and correction",
    body: `${IDENTITY}\n\nPlease provide my EPF passbook/statement and correct any contribution gaps.\n\n{details}`,
  }),
  right("in_consumer_cancel", "consumer", always, "Consumer Protection Act, 2019 — unfair contracts and refunds", {
    kind: "tool",
    tool: "/cancel",
  }),
  right("in_bank_charges", "banking", always, "RBI fair practices / Banking Ombudsman Scheme — unauthorised charges", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber", "details"],
    subject: "Account charges dispute — {accountNumber}",
    body: `${IDENTITY}\n\nPlease provide a charge break-up for account {accountNumber} and reverse unauthorised or incorrect debits.\n\n{details}`,
  }),
  right("in_deposit", "housing", renting, "State rent control / Model Tenancy Act frameworks — security deposit return", {
    kind: "letter",
    recipient: "landlord",
    fields: ["counterparty", "details"],
    subject: "Refund of security deposit",
    body: `${IDENTITY}\n\nThe tenancy has ended. Please refund my security deposit or itemise lawful deductions.\n\n{details}`,
  }),
  right("in_senior_pension_inquiry", "senior", senior, "National Social Assistance Programme / state old-age pension schemes", {
    kind: "letter",
    recipient: "epfo",
    fields: ["municipality", "details"],
    subject: "Old-age pension / NSAP — status",
    body: `${IDENTITY}\n\nPlease confirm the status of my old-age pension application/payment.\n\n{details}`,
  }),
  right("in_family_support", "family", any(parent, lowIncome), "State / central social assistance schemes for families", {
    kind: "letter",
    recipient: "epfo",
    fields: ["municipality", "details"],
    subject: "Family assistance — entitlement check",
    body: `${IDENTITY}\n\nPlease advise on applicable family assistance and any arrears.\n\n{details}`,
  }),
  right("in_disability", "health", disability, "Rights of Persons with Disabilities Act, 2016 — benefits inquiry", {
    kind: "letter",
    recipient: "trader",
    fields: ["counterparty", "details"],
    subject: "Disability-related benefit / accommodation — written response",
    body: `${IDENTITY}\n\nPlease respond in writing regarding the disability-related matter below.\n\n{details}`,
  }),
];

export const IN_PACK: JurisdictionPack = {
  market: "IN",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "en-IN",
  currency: "INR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
