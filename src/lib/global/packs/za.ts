/** South Africa — SASSA / CPA / bank letters. English. */
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

const parent = num("dependents", { gte: 1 });
const renting = oneOf("housing", "renting");
const lowIncome = oneOf("incomeBand", "low");
const disability = is("hasDisability");
const senior = any(num("ageYears", { gte: 60 }), oneOf("employment", "retired"));
const unemployed = oneOf("employment", "unemployed");

const RECIPIENTS: Record<string, string> = {
  sassa: "South African Social Security Agency\n{municipality}",
  bank: "{counterparty}\nCustomer Care",
  trader: "{counterparty}\nCustomer Services",
  landlord: "{counterparty}",
};

const IDENTITY = "I am {name}. My ID / grant number reference is {id}.";

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
  right("za_child_support", "family", parent, "Social Assistance Act 13 of 2004 — Child Support Grant", {
    kind: "letter",
    recipient: "sassa",
    fields: ["municipality"],
    subject: "Child Support Grant — status and arrears",
    body: `${IDENTITY}\n\nPlease confirm my Child Support Grant status and pay any arrears due.`,
  }),
  right("za_old_age", "senior", senior, "Social Assistance Act 13 of 2004 — Older Person's Grant", {
    kind: "letter",
    recipient: "sassa",
    fields: ["municipality"],
    subject: "Older Person's Grant — review",
    body: `${IDENTITY}\n\nPlease review my Older Person's Grant and correct underpayments.`,
  }),
  right("za_disability_grant", "social_security", disability, "Social Assistance Act 13 of 2004 — Disability Grant", {
    kind: "letter",
    recipient: "sassa",
    fields: ["municipality", "details"],
    subject: "Disability Grant — review",
    body: `${IDENTITY}\n\nPlease review my Disability Grant decision/payment.\n\n{details}`,
  }),
  right("za_srd", "social_security", any(unemployed, lowIncome), "Social Assistance Act — Social Relief of Distress (where available)", {
    kind: "letter",
    recipient: "sassa",
    fields: ["municipality"],
    subject: "Social Relief of Distress — status",
    body: `${IDENTITY}\n\nPlease confirm the status of my SRD / social relief application and any amounts owed.`,
  }),
  right("za_cpa_cancel", "consumer", always, "Consumer Protection Act 68 of 2008 — cooling-off and cancellation", {
    kind: "tool",
    tool: "/cancel",
  }),
  right("za_bank_fees", "banking", always, "National Credit Act 34 of 2005 / CPA — fee and charge disputes", {
    kind: "letter",
    recipient: "bank",
    fields: ["counterparty", "accountNumber"],
    subject: "Account charges — {accountNumber}",
    body: `${IDENTITY}\n\nPlease provide a fee breakdown for account {accountNumber} and reverse incorrect charges.`,
  }),
  right("za_deposit", "housing", renting, "Rental Housing Act 50 of 1999 — deposit refund", {
    kind: "letter",
    recipient: "landlord",
    fields: ["counterparty", "details"],
    subject: "Rental deposit refund",
    body: `${IDENTITY}\n\nPlease refund my deposit as required by the Rental Housing Act, or itemise lawful deductions.\n\n{details}`,
  }),
];

export const ZA_PACK: JurisdictionPack = {
  market: "ZA",
  version: "2026.08.3",
  reviewed: "2026-08-03",
  docLocale: "en-ZA",
  currency: "ZAR",
  minorUnits: 100,
  recipients: RECIPIENTS,
  rights,
};
