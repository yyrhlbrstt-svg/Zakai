/** New Zealand — consumer / MSD / bank letters. English. */
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
const senior = any(num("ageYears", { gte: 65 }), oneOf("employment", "retired"));

const RECIPIENTS: Record<string, string> = {
  msd: "Ministry of Social Development\n{municipality}",
  ird: "Inland Revenue\n{municipality}",
  bank: "{counterparty}\nCustomer Care",
  trader: "{counterparty}\nCustomer Services",
  landlord: "{counterparty}",
};

const IDENTITY = "I am {name}. My IRD / client reference is {id}.";

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
  right("nz_working_for_families", "family", any(parent, lowIncome), "Income Tax Act 2007 — Working for Families tax credits", {
    kind: "letter",
    recipient: "ird",
    fields: ["municipality"],
    subject: "Working for Families — entitlement review",
    body: `${IDENTITY}\n\nPlease review my Working for Families entitlement and pay any amount underpaid.`,
  }),
  right("nz_accommodation_supplement", "housing", any(renting, lowIncome), "Social Security Act 2018 — Accommodation Supplement", {
    kind: "letter",
    recipient: "msd",
    fields: ["municipality"],
    subject: "Accommodation Supplement — review",
    body: `${IDENTITY}\n\nPlease review my Accommodation Supplement and correct any underpayment.`,
  }),
  right("nz_nz_super", "senior", senior, "New Zealand Superannuation and Retirement Income Act 2001", {
    kind: "letter",
    recipient: "msd",
    fields: ["municipality"],
    subject: "NZ Superannuation — rate check",
    body: `${IDENTITY}\n\nPlease confirm my NZ Super rate and pay any arrears owing.`,
  }),
  right("nz_bank_fees", "banking", always, "Fair Trading Act 1986 / Credit Contracts and Consumer Finance Act 2003 — fee disputes", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "Bank fees — account {accountNumber}",
    body: `${IDENTITY}\n\nPlease provide a fee breakdown for account {accountNumber} and reverse any unlawful or incorrect charges.`,
  }),
  right("nz_cccfa_hardship", "banking", working, "Credit Contracts and Consumer Finance Act 2003 — borrower hardship", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber", "details"],
    subject: "Hardship variation request — {accountNumber}",
    body: `${IDENTITY}\n\nI request a hardship variation under the CCCFA for agreement {accountNumber}.\n\n{details}`,
  }),
  right("nz_deposit", "housing", renting, "Residential Tenancies Act 1986 — bond refund", {
    kind: "letter",
    recipient: "landlord",
    fields: ["counterparty", "details"],
    subject: "Tenancy bond refund",
    body: `${IDENTITY}\n\nPlease arrange return of my bond via Tenancy Services / as required by the RTA.\n\n{details}`,
  }),
  right("nz_cancel", "consumer", always, "Fair Trading Act 1986 / Consumer Guarantees Act 1993 — cancellation and remedies", {
    kind: "tool",
    tool: "/cancel",
  }),
  right("nz_disability_support", "health", disability, "Social Security Act 2018 — disability-related assistance", {
    kind: "letter",
    recipient: "msd",
    fields: ["municipality", "details"],
    subject: "Disability support — review",
    body: `${IDENTITY}\n\nPlease review my disability-related assistance.\n\n{details}`,
  }),
];

export const NZ_PACK: JurisdictionPack = {
  market: "NZ",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "en-NZ",
  currency: "NZD",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
